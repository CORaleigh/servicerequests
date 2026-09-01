<%@ WebHandler Language="C#" Class="Token" %>
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Configuration;

/// <summary>
/// Exchanges Cityworks credentials for a short-lived token. Credentials are
/// read from appSettings (see cw-secrets.config) and never leave the server.
///
/// Responds with { "Token": "...", "ApiBase": "/admin/Services/AMS/" } on
/// success and { "error": "..." } on failure. ApiBase tells the browser which
/// path this Cityworks instance serves its API from - production uses /admin/,
/// the test instance uses /backdoor/ - so a single build works on either
/// without a rebuild.
///
/// Always responds with JSON - the client calls res.json() on the result, so an
/// IIS HTML error page would surface as an unhelpful parse error.
/// </summary>
public class Token : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

        string loginName = ConfigurationManager.AppSettings["CW_USERNAME"];
        string password  = ConfigurationManager.AppSettings["CW_PASSWORD"];
        string authUrl   = ConfigurationManager.AppSettings["CW_AUTH_URL"];

        if (string.IsNullOrEmpty(loginName) || string.IsNullOrEmpty(password))
        {
            Fail(context, 500, "CW_USERNAME / CW_PASSWORD are not configured on the server.");
            return;
        }
        if (string.IsNullOrEmpty(authUrl))
        {
            Fail(context, 500, "CW_AUTH_URL is not configured on the server.");
            return;
        }

        string apiBase = ResolveApiBase(authUrl);

        // .NET Framework defaults to TLS 1.0, which modern endpoints reject.
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

        // Serialize properly rather than string-concatenating, so a password
        // containing a quote or backslash cannot produce malformed JSON.
        var credentials = new System.Collections.Generic.Dictionary<string, string>
        {
            { "LoginName", loginName },
            { "Password",  password  }
        };
        string json = new JavaScriptSerializer().Serialize(credentials);
        byte[] body = Encoding.UTF8.GetBytes("data=" + Uri.EscapeDataString(json));

        try
        {
            var request = (HttpWebRequest)WebRequest.Create(authUrl);
            request.Method        = "POST";
            request.ContentType   = "application/x-www-form-urlencoded";
            request.ContentLength = body.Length;
            request.Timeout       = 30000;

            using (var stream = request.GetRequestStream())
                stream.Write(body, 0, body.Length);

            string raw;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader   = new StreamReader(response.GetResponseStream()))
                raw = reader.ReadToEnd();

            // Cityworks answers 200 with Status != 0 on a bad credential, so a
            // missing token - not the HTTP status - is what marks a failure.
            string token = ExtractToken(raw);
            if (string.IsNullOrEmpty(token))
            {
                Fail(context, 502, "Cityworks authentication returned no token: " + raw);
                return;
            }

            context.Response.Write(new JavaScriptSerializer().Serialize(
                new System.Collections.Generic.Dictionary<string, string>
                {
                    { "Token",   token   },
                    { "ApiBase", apiBase }
                }));
        }
        catch (WebException ex)
        {
            // Pass through Cityworks' own error body when there is one; it is
            // far more diagnostic than the generic exception message.
            string detail = ex.Message;
            if (ex.Response != null)
            {
                using (var reader = new StreamReader(ex.Response.GetResponseStream()))
                    detail = reader.ReadToEnd();
            }
            Fail(context, 502, "Cityworks authentication failed: " + detail);
        }
        catch (Exception ex)
        {
            Fail(context, 500, "Unexpected error: " + ex.Message);
        }
    }

    /// <summary>
    /// Works out the path the Cityworks API is served from on this instance,
    /// by reusing the prefix of the auth URL that is already configured for it:
    ///
    ///   https://host/admin/Services/General/Authentication/Authenticate
    ///                ^^^^^^                              -> /admin/Services/AMS/
    ///
    /// Deriving it means there is no second setting that can disagree with
    /// CW_AUTH_URL. Set CW_API_BASE explicitly to override, for an instance
    /// that does not follow this layout.
    /// </summary>
    private static string ResolveApiBase(string authUrl)
    {
        string configured = ConfigurationManager.AppSettings["CW_API_BASE"];
        if (!string.IsNullOrEmpty(configured))
        {
            if (!configured.EndsWith("/")) configured += "/";
            return configured;
        }

        try
        {
            string path = new Uri(authUrl).AbsolutePath;
            int idx = path.IndexOf("/Services/", StringComparison.OrdinalIgnoreCase);
            if (idx >= 0) return path.Substring(0, idx) + "/Services/AMS/";
        }
        catch (UriFormatException) { /* fall through to the default */ }

        return "/admin/Services/AMS/";
    }

    /// <summary>
    /// Pulls Value.Token out of the Cityworks auth response, tolerating an
    /// unexpected shape rather than throwing.
    /// </summary>
    private static string ExtractToken(string raw)
    {
        try
        {
            var parsed = new JavaScriptSerializer()
                .Deserialize<System.Collections.Generic.Dictionary<string, object>>(raw);
            if (parsed == null || !parsed.ContainsKey("Value")) return null;

            var value = parsed["Value"] as System.Collections.Generic.Dictionary<string, object>;
            if (value == null || !value.ContainsKey("Token")) return null;

            return value["Token"] as string;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void Fail(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        context.Response.TrySkipIisCustomErrors = true;
        context.Response.Write(new JavaScriptSerializer().Serialize(
            new System.Collections.Generic.Dictionary<string, string> { { "error", message } }));
    }

    public bool IsReusable { get { return false; } }
}
