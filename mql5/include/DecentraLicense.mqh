//+------------------------------------------------------------------+
//|                                      DecentraLicense.mqh          |
//|  Generic license gate for ANY MetaTrader 5 product               |
//|  (indicator OR EA) — completely product-agnostic.                |
//|                                                                  |
//|  It only knows the protocol: it sends licenseKey + deviceId      |
//|  (+ optional productId) to /api/check-license and returns bool.  |
//|                                                                  |
//|  HOW TO USE in your .mq5/.mqh:                                   |
//|    #define DL_API_URL "https://your-app.onrender.com/api/check-license"
//|    #include "DecentraLicense.mqh"                                |
//|                                                                  |
//|    input string InpLicenseKey   = "TRD-XXXX-XXXX-XXXX-XXXX";     |
//|    input string InpProductId    = "my-product-id"; // from admin |
//|                                                                  |
//|    OnInit():                                                     |
//|      if(!dl_Validate(InpLicenseKey, InpProductId))               |
//|      {                                                           |
//|        Print("[License] " + dl_LastError());                     |
//|        return INIT_FAILED;                                       |
//|      }                                                           |
//|                                                                  |
//|    periodic re-check:                                            |
//|      if(!dl_Validate(InpLicenseKey, InpProductId))               |
//|        ExpertRemove();  // or ChartIndicatorDelete(...)           |
//|                                                                  |
//|    dl_LastError() / dl_LastHttp() / dl_LastExpiry() helpers.     |
//|                                                                  |
//|  Non-MetaTrader products use the same endpoint normally — see    |
//|  clients/typescript/validateLicense.ts for a TS equivalent.      |
//+------------------------------------------------------------------+
#ifndef DECENTRALICENSE_MQH
#define DECENTRALICENSE_MQH

#ifndef DL_API_URL
#define DL_API_URL "https://your-domain.onrender.com/api/check-license"
#endif

#ifndef DL_TIMEOUT
#define DL_TIMEOUT 10000
#endif

string dl_LastErrorMsg  = "";
int    dl_LastHttpCode  = 0;
string dl_LastExpiryMsg = "";

//+------------------------------------------------------------------+
//| Stable device fingerprint (for the license device-lock)          |
//| Same terminal + account -> same ID. New PC / reinstall -> new ID |
//+------------------------------------------------------------------+
string dl_HashString(const string text)
{
    uchar bytes[];
    int len = StringToCharArray(text, bytes, 0, WHOLE_ARRAY, CP_UTF8) - 1;
    ulong hash = 14695981039346656037U;
    for(int i = 0; i < len; i++)
    {
        hash ^= bytes[i];
        hash *= 1099511628211U;
    }
    return StringFormat("%016I64x", hash);
}

string dl_DeviceID()
{
    string raw = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "|" +
                 TerminalInfoString(TERMINAL_NAME) + "|" +
                 TerminalInfoString(TERMINAL_PATH) + "|" +
                 AccountInfoString(ACCOUNT_SERVER);
    return dl_HashString(raw);
}

string dl_DeviceID()
{
    string raw = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "|" +
                 TerminalInfoString(TERMINAL_NAME) + "|" +
                 TerminalInfoString(TERMINAL_PATH) + "|" +
                 AccountInfoString(ACCOUNT_SERVER);
    return IntegerToString(StringHash(raw), 16);
}
//+------------------------------------------------------------------+
//| Validate a license against /api/check-license                    |
//| Parameters:                                                      |
//|   key       – the TRD-XXXX license key                           |
//|   productId – (optional) product id from the /admin panel;       |
//|               omit only if the product has no strict binding     |
//|   apiUrl    – overrides DL_API_URL                               |
//|   timeout   – overrides DL_TIMEOUT                               |
//| Returns true only when HTTP 200 with "valid":true.               |
//+------------------------------------------------------------------+
bool dl_Validate(const string key, const string productId = "", const string apiUrl = "", const int timeout = -1)
{
    dl_LastErrorMsg  = "";
    dl_LastHttpCode  = 0;
    dl_LastExpiryMsg = "";

    string url = (apiUrl != "") ? apiUrl : DL_API_URL;
    int    tmo = (timeout > 0)  ? timeout : DL_TIMEOUT;

    //--- minimal format gate (TRD-XXXX-XXXX-XXXX-XXXX, 19 chars)
    if(StringLen(key) != 19 || StringSubstr(key, 0, 4) != "TRD-")
    {
        dl_LastErrorMsg = "Invalid key format. Expected TRD-XXXX-XXXX-XXXX-XXXX";
        return false;
    }

    //--- JSON body: {"licenseKey":"...","deviceId":"..."[, "productId":"..."]}
    string body = "{\"licenseKey\":\"" + key + "\",\"deviceId\":\"" + dl_DeviceID() + "\"";
    if(productId != "")
        body += ",\"productId\":\"" + productId + "\"";
    body += "}";

    string headers = "Content-Type: application/json\r\n";
    char   postData[];
    char   resultData[];
    string responseHeaders;

    int bodyLen = StringToCharArray(body, postData, 0, WHOLE_ARRAY, CP_UTF8) - 1;
    ArrayResize(postData, bodyLen);

    //--- send the request
    int http = WebRequest("POST", url, headers, tmo, postData, resultData, responseHeaders);
    dl_LastHttpCode = http;

    if(http == -1)
    {
        int err = GetLastError();
        dl_LastErrorMsg = "WebRequest failed (error " + IntegerToString(err) + "). " +
                          "If error=4014, add '" + url + "' to " +
                          "Tools -> Options -> Expert Advisors -> Allowed URLs.";
        return false;
    }

    string response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);

    if(http == 200 && StringFind(response, "\"valid\":true") >= 0)
    {
        //--- extract expiresAt for logging (optional)
        int eIdx = StringFind(response, "\"expiresAt\":\"");
        if(eIdx >= 0)
        {
            int s = eIdx + 13;
            int e = StringFind(response, "\"", s);
            if(e > s) dl_LastExpiryMsg = StringSubstr(response, s, e - s);
        }
        return true;
    }

    //--- extract server error message
    int mIdx = StringFind(response, "\"error\":\"");
    if(mIdx >= 0)
    {
        int s = mIdx + 9;
        int e = StringFind(response, "\"", s);
        if(e > s) dl_LastErrorMsg = StringSubstr(response, s, e - s);
    }
    else
    {
        dl_LastErrorMsg = "Rejected (HTTP " + IntegerToString(http) + ")";
    }
    return false;
}

string dl_LastError()  { return dl_LastErrorMsg; }
int    dl_LastHttp()   { return dl_LastHttpCode; }
string dl_LastExpiry() { return dl_LastExpiryMsg; }

#endif // DECENTRALICENSE_MQH