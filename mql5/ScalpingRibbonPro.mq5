//+------------------------------------------------------------------+
//|                                        ScalpingRibbonPro.mq5     |
//|                                VIDYA Ribbon + Color Logic        |
//|                     License gate: DecentraLicense / TRD-XXXX     |
//+------------------------------------------------------------------+
#property indicator_chart_window
#property indicator_buffers 55
#property indicator_plots   26

//+------------------------------------------------------------------+
//| ══════════════════  LICENSE CONFIGURATION  ══════════════════     |
//| Replace the URL below with your deployed Vercel domain.          |
//| Leave everything else in this block unchanged.                   |
//+------------------------------------------------------------------+
#define LICENSE_API_URL  "https://your-domain.vercel.app/api/check-license"
#define LICENSE_TIMEOUT  10000   // ms — max wait per HTTP request
#define RECHECK_BARS     500     // re-validate every N completed bars

//--- Input Parameters
input group "══════════ License ══════════"
input string InpLicenseKey = "TRD-XXXX-XXXX-XXXX-XXXX"; // Your License Key

input group "══════════ VIDYA Ribbon Settings ══════════"
input double InpBufferMultiplier = 0.000010; // Ribbon Buffer Multiplier

//--- Ribbon count and periods
#define RIBBON_COUNT 26
int ribbonPeriods[RIBBON_COUNT] = {
    2,  5,  8,  11,  15,  20,  24,  26,  30,  34,
    38, 42, 45,  50,  59,  68,  77,  86,  95, 105,
   115,125,135, 145, 155, 165
};

//--- Sideways color: #441799 in MQL5 BGR format
#define CUSTOM_PURPLE 0x991744

//--- Named indicator buffers
double vama0[],  color0[],  vama1[],  color1[],  vama2[],  color2[];
double vama3[],  color3[],  vama4[],  color4[],  vama5[],  color5[];
double vama6[],  color6[],  vama7[],  color7[],  vama8[],  color8[];
double vama9[],  color9[],  vama10[], color10[], vama11[], color11[];
double vama12[], color12[], vama13[], color13[], vama14[], color14[];
double vama15[], color15[], vama16[], color16[], vama17[], color17[];
double vama18[], color18[], vama19[], color19[], vama20[], color20[];
double vama21[], color21[], vama22[], color22[], vama23[], color23[];
double vama24[], color24[], vama25[], color25[];

//--- State buffers (readable by EA via CopyBuffer)
// Buf 52 = allGreen  | Buf 53 = allRed  | Buf 54 = allPurple
//
// All Green  → 52=1  53=0  54=0  → EA opens BUY
// All Red    → 52=0  53=1  54=0  → EA opens SELL
// All Purple → 52=0  53=0  54=1  → EA holds
// Mixed      → 52=1  53=1  54=1  → EA holds
double allGreenBuf[];
double allRedBuf[];
double allPurpleBuf[];

//--- Persistent VIDYA state per ribbon
double prevVama[RIBBON_COUNT];

//--- License state
bool   g_licenseValid   = false;
int    g_barsSinceCheck = 0;

//+------------------------------------------------------------------+
//| License validation — sends POST to /api/check-license            |
//| Returns true only when the server returns HTTP 200 + valid:true  |
//+------------------------------------------------------------------+
bool ValidateLicense(const string key)
{
    //--- Basic local format check before hitting the network
    //    Expected: TRD-XXXX-XXXX-XXXX-XXXX  (19 chars, uppercase hex)
    if(StringLen(key) != 19)
    {
        Print("[License] Invalid key format — expected 19 characters, got ",
              StringLen(key));
        return false;
    }

    string prefix = StringSubstr(key, 0, 4);
    if(prefix != "TRD-")
    {
        Print("[License] Invalid key format — must start with TRD-");
        return false;
    }

    //--- Validate each hex segment: positions 4,9,14,19 are dashes
    int dashPos[3] = {8, 13, 18};
    for(int d = 0; d < 3; d++)
    {
        if(StringGetCharacter(key, dashPos[d]) != '-')
        {
            Print("[License] Invalid key format — missing dash at position ",
                  dashPos[d]);
            return false;
        }
    }

    //--- Build JSON body
    string body    = "{\"licenseKey\":\"" + key + "\"}";
    string headers = "Content-Type: application/json\r\n";

    char   postData[];
    char   resultData[];
    string responseHeaders;

    int bodyLen = StringToCharArray(body, postData, 0, WHOLE_ARRAY, CP_UTF8) - 1;
    ArrayResize(postData, bodyLen);

    //--- Send the request
    int httpCode = WebRequest(
        "POST",
        LICENSE_API_URL,
        headers,
        LICENSE_TIMEOUT,
        postData,
        resultData,
        responseHeaders
    );

    //--- Network / config error
    if(httpCode == -1)
    {
        int err = GetLastError();
        Print("[License] WebRequest failed (error ", err, "). "
              "If error=4014, add '", LICENSE_API_URL,
              "' to Tools → Options → Expert Advisors → Allowed URLs.");
        return false;
    }

    //--- Server responded — parse minimal JSON
    string response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);

    if(httpCode == 200 && StringFind(response, "\"valid\":true") >= 0)
    {
        //--- Extract expiresAt for the log (optional, non-critical)
        string expiresAt = "";
        int    eIdx      = StringFind(response, "\"expiresAt\":\"");
        if(eIdx >= 0)
        {
            int start = eIdx + 13;
            int end   = StringFind(response, "\"", start);
            if(end > start)
                expiresAt = StringSubstr(response, start, end - start);
        }
        Print("[License] Valid ✓  Expires: ", expiresAt);
        return true;
    }

    //--- Extract error message for the log
    string errMsg = "unknown";
    int    mIdx   = StringFind(response, "\"error\":\"");
    if(mIdx >= 0)
    {
        int start = mIdx + 9;
        int end   = StringFind(response, "\"", start);
        if(end > start)
            errMsg = StringSubstr(response, start, end - start);
    }

    Print("[License] Rejected (HTTP ", httpCode, "): ", errMsg);
    return false;
}

//+------------------------------------------------------------------+
//| Route-by-index helpers — UNCHANGED                               |
//+------------------------------------------------------------------+
double GetVama(int r, int i) {
    switch(r) {
        case  0: return vama0[i];  case  1: return vama1[i];
        case  2: return vama2[i];  case  3: return vama3[i];
        case  4: return vama4[i];  case  5: return vama5[i];
        case  6: return vama6[i];  case  7: return vama7[i];
        case  8: return vama8[i];  case  9: return vama9[i];
        case 10: return vama10[i]; case 11: return vama11[i];
        case 12: return vama12[i]; case 13: return vama13[i];
        case 14: return vama14[i]; case 15: return vama15[i];
        case 16: return vama16[i]; case 17: return vama17[i];
        case 18: return vama18[i]; case 19: return vama19[i];
        case 20: return vama20[i]; case 21: return vama21[i];
        case 22: return vama22[i]; case 23: return vama23[i];
        case 24: return vama24[i]; case 25: return vama25[i];
    }
    return 0.0;
}

void SetVama(int r, int i, double v) {
    switch(r) {
        case  0: vama0[i]  = v; break; case  1: vama1[i]  = v; break;
        case  2: vama2[i]  = v; break; case  3: vama3[i]  = v; break;
        case  4: vama4[i]  = v; break; case  5: vama5[i]  = v; break;
        case  6: vama6[i]  = v; break; case  7: vama7[i]  = v; break;
        case  8: vama8[i]  = v; break; case  9: vama9[i]  = v; break;
        case 10: vama10[i] = v; break; case 11: vama11[i] = v; break;
        case 12: vama12[i] = v; break; case 13: vama13[i] = v; break;
        case 14: vama14[i] = v; break; case 15: vama15[i] = v; break;
        case 16: vama16[i] = v; break; case 17: vama17[i] = v; break;
        case 18: vama18[i] = v; break; case 19: vama19[i] = v; break;
        case 20: vama20[i] = v; break; case 21: vama21[i] = v; break;
        case 22: vama22[i] = v; break; case 23: vama23[i] = v; break;
        case 24: vama24[i] = v; break; case 25: vama25[i] = v; break;
    }
}

void SetColor(int r, int i, double v) {
    switch(r) {
        case  0: color0[i]  = v; break; case  1: color1[i]  = v; break;
        case  2: color2[i]  = v; break; case  3: color3[i]  = v; break;
        case  4: color4[i]  = v; break; case  5: color5[i]  = v; break;
        case  6: color6[i]  = v; break; case  7: color7[i]  = v; break;
        case  8: color8[i]  = v; break; case  9: color9[i]  = v; break;
        case 10: color10[i] = v; break; case 11: color11[i] = v; break;
        case 12: color12[i] = v; break; case 13: color13[i] = v; break;
        case 14: color14[i] = v; break; case 15: color15[i] = v; break;
        case 16: color16[i] = v; break; case 17: color17[i] = v; break;
        case 18: color18[i] = v; break; case 19: color19[i] = v; break;
        case 20: color20[i] = v; break; case 21: color21[i] = v; break;
        case 22: color22[i] = v; break; case 23: color23[i] = v; break;
        case 24: color24[i] = v; break; case 25: color25[i] = v; break;
    }
}

//+------------------------------------------------------------------+
//| Indicator initialisation                                         |
//+------------------------------------------------------------------+
int OnInit() {

    //==================================================================
    //  LICENSE GATE — runs before any chart/buffer setup
    //==================================================================
    g_licenseValid = ValidateLicense(InpLicenseKey);

    if(!g_licenseValid)
    {
        MessageBox(
            "ScalpingRibbonPro — License Invalid\n\n"
            "Your license key was not accepted.\n"
            "Possible reasons:\n"
            "  • Key expired — renew at your checkout page\n"
            "  • Key mistyped — check for typos\n"
            "  • Network error — check internet & allowed URLs\n\n"
            "Key entered: " + InpLicenseKey,
            "License Error",
            MB_ICONERROR | MB_OK
        );
        return INIT_FAILED;
    }

    g_barsSinceCheck = 0;
    //==================================================================
    //  END LICENSE GATE
    //==================================================================

    SetIndexBuffer(0,  vama0,  INDICATOR_DATA); SetIndexBuffer(1,  color0,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(2,  vama1,  INDICATOR_DATA); SetIndexBuffer(3,  color1,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(4,  vama2,  INDICATOR_DATA); SetIndexBuffer(5,  color2,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(6,  vama3,  INDICATOR_DATA); SetIndexBuffer(7,  color3,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(8,  vama4,  INDICATOR_DATA); SetIndexBuffer(9,  color4,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(10, vama5,  INDICATOR_DATA); SetIndexBuffer(11, color5,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(12, vama6,  INDICATOR_DATA); SetIndexBuffer(13, color6,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(14, vama7,  INDICATOR_DATA); SetIndexBuffer(15, color7,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(16, vama8,  INDICATOR_DATA); SetIndexBuffer(17, color8,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(18, vama9,  INDICATOR_DATA); SetIndexBuffer(19, color9,  INDICATOR_COLOR_INDEX);
    SetIndexBuffer(20, vama10, INDICATOR_DATA); SetIndexBuffer(21, color10, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(22, vama11, INDICATOR_DATA); SetIndexBuffer(23, color11, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(24, vama12, INDICATOR_DATA); SetIndexBuffer(25, color12, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(26, vama13, INDICATOR_DATA); SetIndexBuffer(27, color13, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(28, vama14, INDICATOR_DATA); SetIndexBuffer(29, color14, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(30, vama15, INDICATOR_DATA); SetIndexBuffer(31, color15, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(32, vama16, INDICATOR_DATA); SetIndexBuffer(33, color16, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(34, vama17, INDICATOR_DATA); SetIndexBuffer(35, color17, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(36, vama18, INDICATOR_DATA); SetIndexBuffer(37, color18, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(38, vama19, INDICATOR_DATA); SetIndexBuffer(39, color19, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(40, vama20, INDICATOR_DATA); SetIndexBuffer(41, color20, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(42, vama21, INDICATOR_DATA); SetIndexBuffer(43, color21, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(44, vama22, INDICATOR_DATA); SetIndexBuffer(45, color22, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(46, vama23, INDICATOR_DATA); SetIndexBuffer(47, color23, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(48, vama24, INDICATOR_DATA); SetIndexBuffer(49, color24, INDICATOR_COLOR_INDEX);
    SetIndexBuffer(50, vama25, INDICATOR_DATA); SetIndexBuffer(51, color25, INDICATOR_COLOR_INDEX);

    //--- State buffers: hidden from chart, readable by EA via CopyBuffer
    SetIndexBuffer(52, allGreenBuf,  INDICATOR_CALCULATIONS);
    SetIndexBuffer(53, allRedBuf,    INDICATOR_CALCULATIONS);
    SetIndexBuffer(54, allPurpleBuf, INDICATOR_CALCULATIONS);

    for(int i = 0; i < RIBBON_COUNT; i++) {
        PlotIndexSetInteger(i, PLOT_DRAW_TYPE,     DRAW_COLOR_LINE);
        PlotIndexSetInteger(i, PLOT_COLOR_INDEXES, 3);
        PlotIndexSetInteger(i, PLOT_LINE_COLOR, 0, CUSTOM_PURPLE);
        PlotIndexSetInteger(i, PLOT_LINE_COLOR, 1, clrGreen);
        PlotIndexSetInteger(i, PLOT_LINE_COLOR, 2, clrRed);
        PlotIndexSetInteger(i, PLOT_LINE_WIDTH,  1);
        PlotIndexSetString(i,  PLOT_LABEL, "VAMA" + IntegerToString(ribbonPeriods[i]));
    }

    ArrayInitialize(prevVama, 0.0);

    ChartSetInteger(0, CHART_AUTOSCROLL, true);
    ChartSetInteger(0, CHART_SHIFT,      true);
    ChartRedraw(0);

    return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Main calculation — VIDYA core UNCHANGED                          |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[]) {

    if(rates_total < 2) return 0;

    //==================================================================
    //  PERIODIC LICENSE RE-CHECK
    //  Fires on each newly completed bar (prev_calculated advances).
    //  Uses the bar count to throttle — does NOT slow down tick updates.
    //==================================================================
    bool isNewBar = (prev_calculated < rates_total);
    if(isNewBar)
    {
        g_barsSinceCheck++;
        if(g_barsSinceCheck >= RECHECK_BARS)
        {
            g_barsSinceCheck = 0;
            g_licenseValid   = ValidateLicense(InpLicenseKey);

            if(!g_licenseValid)
            {
                Print("[License] Subscription expired or revoked — indicator removed.");
                ChartIndicatorDelete(0, 0, MQLInfoString(MQL_PROGRAM_NAME));
                return 0;
            }
        }
    }

    //--- Safety guard: if somehow state is invalid, produce no output
    if(!g_licenseValid) return 0;
    //==================================================================
    //  END PERIODIC RE-CHECK
    //==================================================================

    int startBar;
    if(prev_calculated == 0) {
        for(int r = 0; r < RIBBON_COUNT; r++) {
            prevVama[r] = close[0];
            SetVama(r, 0, close[0]);
            SetColor(r, 0, 0.0);
        }
        allGreenBuf[0]  = 0.0;
        allRedBuf[0]    = 0.0;
        allPurpleBuf[0] = 1.0;
        startBar = 1;
    } else {
        startBar = prev_calculated - 1;
    }

    for(int i = startBar; i < rates_total; i++) {
        double threshold = close[i] * InpBufferMultiplier;
        bool   isLive    = (i == rates_total - 1);

        int greenCount  = 0;
        int redCount    = 0;
        int purpleCount = 0;

        for(int r = 0; r < RIBBON_COUNT; r++) {
            int period = ribbonPeriods[r];

            double atr   = 0.0;
            int    kFrom = MathMax(i - period + 1, 1);
            for(int k = kFrom; k <= i; k++)
                atr += MathAbs(close[k] - close[k - 1]);
            int used = i - kFrom + 1;
            if(used > 0) atr /= used;

            double volAdj   = (close[i] > 0.0) ? (atr / close[i]) * 10.0 : 0.0;
            double alpha    = 2.0 / (period + 1.0);
            double volAlpha = MathMin(alpha * (1.0 + volAdj), 1.0);

            double vama  = volAlpha * close[i] + prevVama[r] * (1.0 - volAlpha);
            SetVama(r, i, vama);

            double vprev = GetVama(r, i - 1);

            double colorVal;
            if     (vama > vprev + threshold) colorVal = 1.0;  // green
            else if(vama < vprev - threshold) colorVal = 2.0;  // red
            else                              colorVal = 0.0;  // purple

            SetColor(r, i, colorVal);

            if      (colorVal == 1.0) greenCount++;
            else if (colorVal == 2.0) redCount++;
            else                      purpleCount++;

            if(!isLive) prevVama[r] = vama;
        }

        //--- Determine state
        bool isAllGreen  = (greenCount  == RIBBON_COUNT);
        bool isAllRed    = (redCount    == RIBBON_COUNT);
        bool isAllPurple = (purpleCount == RIBBON_COUNT);
        bool isMixed     = (!isAllGreen && !isAllRed && !isAllPurple);

        //--- Write state buffers
        // All Green  → 52=1  53=0  54=0  → EA buys
        // All Red    → 52=0  53=1  54=0  → EA sells
        // All Purple → 52=0  53=0  54=1  → EA holds
        // Mixed      → 52=1  53=1  54=1  → EA holds
        allGreenBuf[i]  = (isAllGreen  || isMixed) ? 1.0 : 0.0;
        allRedBuf[i]    = (isAllRed    || isMixed) ? 1.0 : 0.0;
        allPurpleBuf[i] = (isAllPurple || isMixed) ? 1.0 : 0.0;
    }

    return(rates_total);
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason) {}
//+------------------------------------------------------------------+
