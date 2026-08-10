<%@ WebHandler Language="C#" Class="Token" %>
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Configuration;

/// <summary>
/// Exchanges Cityworks credentials for a short-lived token and returns the
/// Cityworks JSON response to the browser. Credentials are read from
/// appSettings (see cw-secrets.config) and never leave the server.
///
/// Always responds with JSON — the client calls res.json() on the result, so an
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

            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader   = new StreamReader(response.GetResponseStream()))
                context.Response.Write(reader.ReadToEnd());
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

    private static void Fail(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        context.Response.TrySkipIisCustomErrors = true;
        context.Response.Write(new JavaScriptSerializer().Serialize(
            new System.Collections.Generic.Dictionary<string, string> { { "error", message } }));
    }

    public bool IsReusable { get { return false; } }
}
