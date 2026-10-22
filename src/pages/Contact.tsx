 import { useState } from 'react';
 import { Mail, Send, Loader2 } from 'lucide-react';
 import Header from '@/components/Header';
import Seo from '@/components/Seo';
 import Footer from '@/components/Footer';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 
 const Contact = () => {
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [formData, setFormData] = useState({
     name: '',
     email: '',
     subject: '',
     message: '',
   });
 
   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
     setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsSubmitting(true);
 
     try {
       const { data, error } = await supabase.functions.invoke('contact-form', {
         body: formData,
       });
 
       if (error) throw error;
 
       toast({
         title: 'Melding sendt!',
         description: 'Vi har mottatt din henvendelse og vil svare så snart som mulig.',
       });
 
       setFormData({ name: '', email: '', subject: '', message: '' });
     } catch (error: any) {
       console.error('Error sending contact form:', error);
       toast({
         title: 'Feil ved sending',
         description: error.message || 'Kunne ikke sende melding. Prøv igjen senere.',
         variant: 'destructive',
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <div className="min-h-screen flex flex-col bg-background">
       <Seo
        title="Kontakt Fagerborg BK"
        description="Kontakt Fagerborg BK om medlemskap, treninger, samarbeid eller andre spørsmål via skjema eller e-post."
        path="/kontakt"
      />
      <Header />
       
       <main className="flex-1">
         {/* Hero Section */}
         <section className="bg-primary py-16 md:py-24">
           <div className="container mx-auto px-4 text-center">
             <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
               Kontakt oss
             </h1>
             <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
               Har du spørsmål om medlemskap, treninger eller noe annet? Send oss en melding!
             </p>
           </div>
         </section>
 
         <div className="container mx-auto px-4 py-12 md:py-16 max-w-2xl">
           <Card>
             <CardContent className="pt-6">
               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="name">Navn</Label>
                     <Input
                       id="name"
                       name="name"
                       value={formData.name}
                       onChange={handleChange}
                       required
                       maxLength={100}
                       placeholder="Ditt navn"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="email">E-post</Label>
                     <Input
                       id="email"
                       name="email"
                       type="email"
                       value={formData.email}
                       onChange={handleChange}
                       required
                       maxLength={255}
                       placeholder="din@epost.no"
                     />
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="subject">Emne</Label>
                   <Input
                     id="subject"
                     name="subject"
                     value={formData.subject}
                     onChange={handleChange}
                     required
                     maxLength={200}
                     placeholder="Hva gjelder henvendelsen?"
                   />
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="message">Melding</Label>
                   <Textarea
                     id="message"
                     name="message"
                     value={formData.message}
                     onChange={handleChange}
                     required
                     maxLength={5000}
                     rows={6}
                     placeholder="Skriv din melding her..."
                   />
                 </div>
 
                 <Button type="submit" disabled={isSubmitting} className="w-full">
                   {isSubmitting ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Sender...
                     </>
                   ) : (
                     <>
                       <Send className="mr-2 h-4 w-4" />
                       Send melding
                     </>
                   )}
                 </Button>
               </form>
 
               <div className="mt-8 pt-6 border-t text-center text-muted-foreground">
                 <p className="flex items-center justify-center gap-2">
                   <Mail className="h-4 w-4" />
                   Du kan også nå oss direkte på{' '}
                   <a href="mailto:post@fagerborgbk.no" className="text-primary hover:underline">
                     post@fagerborgbk.no
                   </a>
                 </p>
               </div>
             </CardContent>
           </Card>
         </div>
       </main>
 
       <Footer />
     </div>
   );
 };
 
 export default Contact;