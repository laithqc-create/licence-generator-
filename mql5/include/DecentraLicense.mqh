//+------------------------------------------------------------------+
//|                                       DecentraLicense.mqh        |
//|   ONE generic license gate for ANY MetaTrader 5 product.          |
//|   Works inside Indicators, Expert Advisors AND Scripts.           |
//|   Completely product-agnostic: it knows nothing about your        |
//|   trading logic, it only knows the license protocol.              |
//|                                                                   |
//|   WHY WinINet (and NOT WebRequest)?                               |
//|   MetaTrader 5 FORBIDS WebRequest() inside Custom Indicators —    |
//|   it always fails with error 4014 (ERR_FUNCTION_NOT_ALLOWED) no   |
//|   matter what you add to Tools -> Options -> Allowed URLs.        |
//|   So this snippet talks HTTPS through the native Windows WinINet  |
//|   API (wininet.dll), which is allowed in indicators, EAs and      |
//|   scripts. If DLL imports are switched off, it automatically      |
//|   falls back to WebRequest() when running in an EA / script.      |
//|                                                                   |
//|   ONE-TIME SETUP PER TERMINAL (each user, only once):             |
//|     Tools -> Options -> Expert Advisors -> [x] Allow DLL imports  |
//|   No URL whitelist is needed: WinINet bypasses the MT5 URL list.  |
//|                                                                   |
//|   INSTALL: copy this file to <terminal>\MQL5\Include\             |
//|                                                                   |
//|   USAGE in any .mq5 / .mqh:                                       |
//|                                                                   |
//|     #define DL_API_URL "https://your-app.onrender.com/api/check-license"
//|     #include <DecentraLicense.mqh>                                |
//|                                                                   |
//|     input string InpLicenseKey = "TRD-XXXX-XXXX-XXXX-XXXX";       |
//|                                                                   |
//|     int OnInit()                                                  |
//|     {                                                             |
//|        if(!dl_Validate(InpLicenseKey, "my-product-id"))           |
//|        {                                                          |
//|           Print("[License] ", dl_LastError());                    |
//|           return(INIT_FAILED);                                    |
//|        }                                                          |
//|        return(INIT_SUCCEEDED);                                    |
//|     }                                                             |
//|                                                                   |
//|     // periodic re-check (e.g. every 500 bars):                   |
//|     if(!dl_Validate(InpLicenseKey, "my-product-id"))              |
//|        return(INIT_FAILED);   // or stop trading / remove the EA  |
//|                                                                   |
//|   Helpers: dl_LastError(), dl_LastHttp(), dl_LastExpiry()         |
//|                                                                   |
//|   The HTTP contract is identical for NON-MetaTrader products, so  |
//|   websites / Node bots / desktop apps simply POST the same JSON.  |
//|   See clients/typescript/validateLicense.ts for that version.     |
//+------------------------------------------------------------------+
#ifndef DECENTRALICENSE_MQH
#define DECENTRALICENSE_MQH

//--- Override any of these BEFORE including this file
#ifndef DL_API_URL
   #define DL_API_URL "https://your-domain.onrender.com/api/check-license"
#endif
#ifndef DL_TIMEOUT
   #define DL_TIMEOUT 10000            // milliseconds per HTTP phase
#endif
#ifndef DL_KEY_LENGTH
   #define DL_KEY_LENGTH 23            // TRD-XXXX-XXXX-XXXX-XXXX
#endif

//--- WinINet constants (wininet.dll ships with every Windows version)
#define DL_OPEN_TYPE_DIRECT       1
#define DL_SERVICE_HTTP           3
#define DL_FLAG_RELOAD            0x80000000
#define DL_FLAG_PRAGMA_NOCACHE    0x00000100
#define DL_FLAG_NO_CACHE_WRITE    0x04000000
#define DL_FLAG_SECURE            0x00800000
#define DL_FLAG_IGNORE_CERT_CN    0x00001000
#define DL_FLAG_IGNORE_CERT_DATE  0x00002000
#define DL_OPT_CONNECT_TIMEOUT    2
#define DL_OPT_SEND_TIMEOUT       5
#define DL_OPT_RECEIVE_TIMEOUT    6
#define DL_QUERY_STATUS_CODE      0x20000013  // HTTP_QUERY_STATUS_CODE | FLAG_NUMBER

#import "wininet.dll"
long InternetOpenW(string lpszAgent, int dwAccessType, string lpszProxy, string lpszProxyBypass, int dwFlags);
long InternetConnectW(long hInternet, string lpszServerName, int nServerPort, string lpszUsername, string lpszPassword, int dwService, int dwFlags, int dwContext);
long HttpOpenRequestW(long hConnect, string lpszVerb, string lpszObjectName, string lpszVersion, string lpszReferrer, long lplpszAcceptTypes, int dwFlags, int dwContext);
bool HttpSendRequestW(long hRequest, string lpszHeaders, int dwHeadersLength, uchar &lpOptional[], int dwOptionalLength);
bool HttpQueryInfoW(long hRequest, int dwInfoLevel, int &lpBuffer, int &lpdwBufferLength, int &lpdwIndex);
bool InternetReadFile(long hFile, uchar &lpBuffer[], int dwNumberOfBytesToRead, int &lpdwNumberOfBytesRead);
bool InternetSetOptionW(long hInternet, int dwOption, int &lpBuffer, int dwBufferLength);
bool InternetCloseHandle(long hInternet);
#import

//--- Result state of the last dl_Validate() call
string dl_LastErrorMsg    = "";
int    dl_LastHttpCode    = 0;
string dl_LastExpiryMsg   = "";
bool   dl_LastUsedWinINet = false;

//+------------------------------------------------------------------+
//| Extract a JSON string value:  "field":"value"                     |
//+------------------------------------------------------------------+
string dl_JsonString(const string json, const string field)
{
   string needle = "\"" + field + "\":\"";
   int idx = StringFind(json, needle);
   if(idx < 0) return("");

   int s = idx + StringLen(needle);
   int e = StringFind(json, "\"", s);
   if(e <= s) return("");

   return(StringSubstr(json, s, e - s));
}

//+------------------------------------------------------------------+
//| Split https://host:port/path into its parts                      |
//+------------------------------------------------------------------+
void dl_ParseUrl(const string url, string &host, string &path, int &port, bool &isHttps)
{
   isHttps = true;
   port    = 443;

   string rest = url;
   if(StringFind(rest, "https://") == 0)
   {
      isHttps = true;
      port = 443;
      rest = StringSubstr(rest, 8);
   }
   else if(StringFind(rest, "http://") == 0)
   {
      isHttps = false;
      port = 80;
      rest = StringSubstr(rest, 7);
   }

   int slash = StringFind(rest, "/");
   if(slash >= 0)
   {
      host = StringSubstr(rest, 0, slash);
      path = StringSubstr(rest, slash);
   }
   else
   {
      host = rest;
      path = "/";
   }

   int colon = StringFind(host, ":");
   if(colon >= 0)
   {
      port = (int)StringToInteger(StringSubstr(host, colon + 1));
      host = StringSubstr(host, 0, colon);
   }
}

//+------------------------------------------------------------------+
//| HTTPS POST through Windows WinINet — works inside INDICATORS too  |
//| (MT5 blocks WebRequest there with error 4014, WinINet is fine)    |
//+------------------------------------------------------------------+
bool dl_PostWinINet(const string url, const string jsonBody, const int timeoutMs, string &responseOut)
{
   responseOut     = "";
   dl_LastHttpCode = 0;

   string host = "", path = "/";
   int    port = 443;
   bool   isHttps = true;
   dl_ParseUrl(url, host, path, port, isHttps);

   long hInternet = InternetOpenW("DecentraLicense/1.0", DL_OPEN_TYPE_DIRECT, "", "", 0);
   if(hInternet == 0)
   {
      dl_LastErrorMsg = "WinINet: could not initialise the Internet session.";
      return false;
   }

   int tmo = (timeoutMs > 0) ? timeoutMs : DL_TIMEOUT;
   InternetSetOptionW(hInternet, DL_OPT_CONNECT_TIMEOUT, tmo, 4);
   InternetSetOptionW(hInternet, DL_OPT_SEND_TIMEOUT,    tmo, 4);
   InternetSetOptionW(hInternet, DL_OPT_RECEIVE_TIMEOUT, tmo, 4);

   long hConnect = InternetConnectW(hInternet, host, port, "", "", DL_SERVICE_HTTP, 0, 0);
   if(hConnect == 0)
   {
      dl_LastErrorMsg = "WinINet: cannot connect to " + host + ":" + IntegerToString(port) + ".";
      InternetCloseHandle(hInternet);
      return false;
   }

   uint uFlags = (uint)DL_FLAG_RELOAD | (uint)DL_FLAG_PRAGMA_NOCACHE | (uint)DL_FLAG_NO_CACHE_WRITE;
   if(isHttps)
      uFlags |= (uint)DL_FLAG_SECURE | (uint)DL_FLAG_IGNORE_CERT_CN | (uint)DL_FLAG_IGNORE_CERT_DATE;

   long hRequest = HttpOpenRequestW(hConnect, "POST", path, "", "", 0, (int)uFlags, 0);
   if(hRequest == 0)
   {
      dl_LastErrorMsg = "WinINet: could not open the request for " + path + ".";
      InternetCloseHandle(hConnect);
      InternetCloseHandle(hInternet);
      return false;
   }

   string headers = "Content-Type: application/json\r\n";
   uchar  postData[];
   int    bodyLen = StringToCharArray(jsonBody, postData, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   ArrayResize(postData, bodyLen);

   if(!HttpSendRequestW(hRequest, headers, StringLen(headers), postData, bodyLen))
   {
      dl_LastErrorMsg = "Cannot reach the license server (" + host + "). Check your internet connection.";
      InternetCloseHandle(hRequest);
      InternetCloseHandle(hConnect);
      InternetCloseHandle(hInternet);
      return false;
   }

   int statusCode = 0, bufLen = 4, qIndex = 0;
   if(HttpQueryInfoW(hRequest, DL_QUERY_STATUS_CODE, statusCode, bufLen, qIndex))
      dl_LastHttpCode = statusCode;

   uchar chunk[4096];
   uchar body[];
   int   read = 0;
   ArrayResize(body, 0);

   while(InternetReadFile(hRequest, chunk, 4096, read) && read > 0)
   {
      int have = ArraySize(body);
      ArrayResize(body, have + read);
      ArrayCopy(body, chunk, have, 0, read);
   }

   InternetCloseHandle(hRequest);
   InternetCloseHandle(hConnect);
   InternetCloseHandle(hInternet);

   if(ArraySize(body) > 0)
   {
      responseOut = CharArrayToString(body, 0, ArraySize(body), CP_UTF8);
      if(dl_LastHttpCode == 0) dl_LastHttpCode = 200;   // body received, status not reported
      return true;
   }

   dl_LastErrorMsg = "Empty response from " + url + ".";
   return false;
}

//+------------------------------------------------------------------+
//| HTTPS POST through MetaTrader WebRequest (EAs / scripts only)     |
//+------------------------------------------------------------------+
bool dl_PostWebRequest(const string url, const string jsonBody, string &responseOut)
{
   responseOut     = "";
   dl_LastHttpCode = 0;

   string headers = "Content-Type: application/json\r\n";
   char   postData[];
   char   resultData[];
   string responseHeaders;

   int bodyLen = StringToCharArray(jsonBody, postData, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   ArrayResize(postData, bodyLen);

   ResetLastError();
   int http = WebRequest("POST", url, headers, DL_TIMEOUT, postData, resultData, responseHeaders);

   if(http == -1)
   {
      int err = GetLastError();
      dl_LastErrorMsg = "WebRequest failed (error " + IntegerToString(err) + ").";
      if(err == 4014)
         dl_LastErrorMsg += " Add '" + url + "' to Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.";
      return false;
   }

   dl_LastHttpCode = http;
   responseOut     = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return true;
}

//+------------------------------------------------------------------+
//| Transport dispatcher                                             |
//|   1) WinINet    — indicators, EAs, scripts (preferred)           |
//|   2) WebRequest — fallback when "Allow DLL imports" is off       |
//+------------------------------------------------------------------+
bool dl_Post(const string url, const string jsonBody, const int timeoutMs, string &responseOut)
{
   if(MQLInfoInteger(MQL_DLLS_ALLOWED))
   {
      dl_LastUsedWinINet = true;
      return dl_PostWinINet(url, jsonBody, timeoutMs, responseOut);
   }

   dl_LastUsedWinINet = false;

   if(MQLInfoInteger(MQL_PROGRAM_TYPE) == PROGRAM_INDICATOR)
   {
      dl_LastErrorMsg = "DLL imports are disabled and MetaTrader does not allow WebRequest inside indicators. " +
                        "Enable Tools -> Options -> Expert Advisors -> 'Allow DLL imports', then reload this indicator.";
      return false;
   }

   return dl_PostWebRequest(url, jsonBody, responseOut);
}

//+------------------------------------------------------------------+
//| FNV-1a 64-bit hash (pure MQL5, no dependencies)                   |
//+------------------------------------------------------------------+
string dl_HashString(const string text)
{
   uchar bytes[];
   int   len  = StringToCharArray(text, bytes, 0, WHOLE_ARRAY, CP_UTF8) - 1;
   ulong hash = 14695981039346656037U;   // FNV offset basis
   for(int i = 0; i < len; i++)
   {
      hash ^= (ulong)bytes[i];
      hash *= 1099511628211U;            // FNV prime
   }
   return StringFormat("%016I64x", hash);
}

//+------------------------------------------------------------------+
//| Stable device fingerprint used by the license device-lock         |
//| (same account + same terminal = same id; new PC = new id)         |
//+------------------------------------------------------------------+
string dl_DeviceID()
{
   string raw = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "|" +
                TerminalInfoString(TERMINAL_NAME)                   + "|" +
                TerminalInfoString(TERMINAL_PATH)                   + "|" +
                AccountInfoString(ACCOUNT_SERVER);
   return dl_HashString(raw);
}

//+------------------------------------------------------------------+
//| Validate a license against  POST /api/check-license               |
//|                                                                   |
//|   key       — "TRD-XXXX-XXXX-XXXX-XXXX" (23 chars)                |
//|   productId — (optional) product id from the admin panel;         |
//|               pass it to bind the license to one product          |
//|   apiUrl    — (optional) overrides DL_API_URL                     |
//|   timeoutMs — (optional) overrides DL_TIMEOUT                     |
//|                                                                   |
//| Returns true only on HTTP 200 with  "valid":true.                 |
//| On failure read dl_LastError() / dl_LastHttp().                   |
//+------------------------------------------------------------------+
bool dl_Validate(const string key, const string productId = "", const string apiUrl = "", const int timeoutMs = -1)
{
   dl_LastErrorMsg    = "";
   dl_LastHttpCode    = 0;
   dl_LastExpiryMsg   = "";
   dl_LastUsedWinINet = false;

   string url = (apiUrl != "")   ? apiUrl    : DL_API_URL;
   int    tmo = (timeoutMs > 0)  ? timeoutMs : DL_TIMEOUT;

   //--- normalise the key
   string k = key;
   StringTrimLeft(k);
   StringTrimRight(k);
   StringToUpper(k);

   if(StringLen(k) != DL_KEY_LENGTH || StringSubstr(k, 0, 4) != "TRD-")
   {
      dl_LastErrorMsg = "Invalid key format: expected TRD-XXXX-XXXX-XXXX-XXXX (" +
                        IntegerToString(DL_KEY_LENGTH) + " characters), got " +
                        IntegerToString(StringLen(k)) + ".";
      return false;
   }

   string pid = productId;
   StringTrimLeft(pid);
   StringTrimRight(pid);

   //--- {"licenseKey":"...","deviceId":"..."[,"productId":"..."]}
   string json = "{\"licenseKey\":\"" + k + "\",\"deviceId\":\"" + dl_DeviceID() + "\"";
   if(pid != "")
      json += ",\"productId\":\"" + pid + "\"";
   json += "}";

   //--- send it
   string response = "";
   if(!dl_Post(url, json, tmo, response))
      return false;                     // dl_LastErrorMsg is already set

   //--- 200 + "valid":true  -> licensed
   if(dl_LastHttpCode == 200 && StringFind(response, "\"valid\":true") >= 0)
   {
      dl_LastExpiryMsg = dl_JsonString(response, "expiresAt");
      return true;
   }

   //--- otherwise surface the server's message
   string serverMsg = dl_JsonString(response, "error");
   if(serverMsg == "") serverMsg = dl_JsonString(response, "reason");

   if(serverMsg != "")
      dl_LastErrorMsg = serverMsg;
   else if(response == "")
      dl_LastErrorMsg = "Empty response from " + url + ".";
   else
      dl_LastErrorMsg = "License rejected (HTTP " + IntegerToString(dl_LastHttpCode) + ").";

   return false;
}

//+------------------------------------------------------------------+
//| Human-readable result of the last dl_Validate() call              |
//+------------------------------------------------------------------+
string dl_LastError()   { return dl_LastErrorMsg; }     // "" when the last check was OK
int    dl_LastHttp()    { return dl_LastHttpCode; }     // 200 / 400 / 403 / 404 / 500
string dl_LastExpiry()  { return dl_LastExpiryMsg; }    // ISO date from the server
bool   dl_UsedWinINet() { return dl_LastUsedWinINet; }  // which transport was used

#endif // DECENTRALICENSE_MQH
