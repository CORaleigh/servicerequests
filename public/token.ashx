<%@ WebHandler Language="C#" Class="Token" %>
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Web;
using System.Configuration;

/// <summary>
/// Exchanges Cityworks credentials (stored in web.config appSettings) for a
/// short-lived token and returns it as JSON to the browser.
/// Credentials never leave the server.
/// </summary>
public class Token : IHttpHandler
{
    public void ProcessRequest(HttpContext context)
    {
        string loginName = ConfigurationManager.AppSettings["CW_USERNAME"];
        string password  = ConfigurationManager.AppSettings["CW_PASSWORD"];
        string authUrl   = ConfigurationManager.AppSettings["CW_AUTH_URL"]
            ?? "https://cityworks.raleighnc.gov/admin/Services/General/Authentication/Authenticate";

        string body = "data=" + Uri.EscapeDataString(
            string.Format("{{\"LoginName\":\"{0}\",\"Password\":\"{1}\"}}", loginName, password));

        var request = (HttpWebRequest)WebRequest.Create(authUrl);
        request.Method      = "POST";
        request.ContentType = "application/x-www-form-urlencoded";
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        request.ContentLength = bytes.Length;

        using (var stream = request.GetRequestStream())
            stream.Write(bytes, 0, bytes.Length);

        using (var response = (HttpWebResponse)request.GetResponse())
        using (var reader   = new StreamReader(response.GetResponseStream()))
        {
            context.Response.ContentType = "application/json";
            context.Response.Write(reader.ReadToEnd());
        }
    }

    public bool IsReusable { get { return false; } }
}
