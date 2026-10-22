 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { htmlEscape } from "../_shared/adminAuth.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 interface ContactFormRequest {
   name: string;
   email: string;
   subject: string;
   message: string;
 }
 
 const handler = async (req: Request): Promise<Response> => {
   // Handle CORS preflight requests
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const { name, email, subject, message }: ContactFormRequest = await req.json();
 
     // Validate required fields
     if (!name || !email || !subject || !message) {
       console.error("Missing required fields:", { name: !!name, email: !!email, subject: !!subject, message: !!message });
       return new Response(
         JSON.stringify({ error: "Alle felt må fylles ut" }),
         { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     // Basic email validation
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
       console.error("Invalid email format:", email);
       return new Response(
         JSON.stringify({ error: "Ugyldig e-postadresse" }),
         { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     // Validate input lengths
     if (name.length > 100 || email.length > 255 || subject.length > 200 || message.length > 5000) {
       console.error("Input too long");
       return new Response(
         JSON.stringify({ error: "En eller flere felt er for lange" }),
         { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
       );
     }
 
     console.log("Sending contact form email from:", email, "subject:", subject);
 
    const safeName = htmlEscape(name);
    const safeEmail = htmlEscape(email);
    const safeSubject = htmlEscape(subject);
    const safeMessage = htmlEscape(message).replace(/\n/g, "<br>");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      },
      body: JSON.stringify({
        from: "Fagerborg BK <post@support.fagerborgbk.no>",
        to: ["post@fagerborgbk.no", "guillaume@fagerborgbk.no"],
        reply_to: email,
        subject: `Kontaktskjema: ${safeSubject}`.slice(0, 250),
        html: `
        <h2>Ny henvendelse fra kontaktskjema</h2>
        <p><strong>Navn:</strong> ${safeName}</p>
        <p><strong>E-post:</strong> ${safeEmail}</p>
        <p><strong>Emne:</strong> ${safeSubject}</p>
        <hr />
        <h3>Melding:</h3>
        <p>${safeMessage}</p>
      `,
      }),
    });
 
     if (!res.ok) {
       const errorData = await res.json();
       console.error("Resend API error:", errorData);
       throw new Error("Failed to send email");
     }
 
     const emailResponse = await res.json();
     console.log("Email sent successfully:", emailResponse);
 
     return new Response(JSON.stringify({ success: true }), {
       status: 200,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   } catch (error: any) {
     console.error("Error in contact-form function:", error);
     return new Response(
       JSON.stringify({ error: "Kunne ikke sende melding. Prøv igjen senere." }),
       { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
     );
   }
 };
 
 serve(handler);