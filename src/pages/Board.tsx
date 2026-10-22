 import Header from '@/components/Header';
import Seo from '@/components/Seo';
 import Footer from '@/components/Footer';
 import { Card, CardContent } from '@/components/ui/card';
 import { useBoardMembers } from '@/hooks/useBoardMembers';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Users, Mail } from 'lucide-react';
 
 const Board = () => {
   const { data: boardMembers, isLoading } = useBoardMembers();
 
   // Group members by role type
   const getRoleOrder = (role: string) => {
     const lower = role.toLowerCase();
     if (lower.includes('styreleder') && !lower.includes('nestleder')) return 0;
     if (lower.includes('nestleder')) return 1;
     if (lower.includes('daglig leder')) return 2;
     return 3; // Styremedlemmer
   };
 
   const sortedMembers = boardMembers?.slice().sort((a, b) => {
     return getRoleOrder(a.role) - getRoleOrder(b.role);
   });
 
   return (
     <div className="min-h-screen flex flex-col bg-background">
       <Seo
        title="Styret i Fagerborg BK"
        description="Møt styret og de tillitsvalgte som leder Fagerborg BK, med roller og kontaktinformasjon."
        path="/styret"
      />
      <Header />
       
        <main className="flex-1 pt-20">
          {/* Hero Section */}
          <section className="bg-primary py-16 md:py-24">
           <div className="container mx-auto px-4 text-center">
             <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
               Styret
             </h1>
             <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
               Møt menneskene som leder Fagerborg BK
             </p>
           </div>
         </section>
 
         <div className="container mx-auto px-4 py-12 md:py-16">
           <h2 className="text-2xl font-bold text-center mb-8">Styremedlemmer og tillitsvalgte</h2>
           {isLoading ? (
             <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
               {[1, 2, 3, 4, 5, 6].map(i => (
                 <Card key={i}>
                   <CardContent className="pt-6 text-center">
                     <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
                     <Skeleton className="h-5 w-32 mx-auto mb-2" />
                     <Skeleton className="h-4 w-24 mx-auto" />
                   </CardContent>
                 </Card>
               ))}
             </div>
           ) : sortedMembers && sortedMembers.length > 0 ? (
             <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
               {sortedMembers.map((member, index) => (
                 <Card key={index} className="overflow-hidden">
                   <CardContent className="pt-6 text-center">
                     <div className="w-20 h-20 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                       <Users className="w-10 h-10 text-primary" />
                     </div>
                     <h3 className="font-semibold text-lg">{member.name}</h3>
                     <p className="text-sm text-muted-foreground mb-2">{member.role}</p>
                     {member.email && (
                       <a 
                         href={`mailto:${member.email}`}
                         className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                       >
                         <Mail className="h-3 w-3" />
                         {member.email}
                       </a>
                     )}
                   </CardContent>
                 </Card>
               ))}
             </div>
           ) : (
             <Card className="max-w-md mx-auto">
               <CardContent className="pt-6 text-center text-muted-foreground">
                 <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                 <p>Ingen styremedlemmer lagt til ennå.</p>
               </CardContent>
             </Card>
           )}
         </div>
       </main>
 
       <Footer />
     </div>
   );
 };
 
 export default Board;