import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Seo from '@/components/Seo';
import PlayerApplicationForm from '@/components/PlayerApplicationForm';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
export default function BecomePlayer(){return <div className="min-h-screen bg-page-gradient"><Seo title="Bli spiller i Fagerborg BK" description="Søk om å bli spiller i Fagerborg Ballklub. Spillersøknader behandles av klubben før innmelding." path="/bli-spiller"/><Header/><main className="pt-28 pb-16"><div className="container max-w-3xl mx-auto px-4 py-8"><h1 className="text-4xl font-bold mb-3">Bli spiller</h1><p className="text-muted-foreground mb-8">Fagerborg Ballklub · sesongen 2027</p><PlayerApplicationForm/><div className="border-t mt-10 pt-6"><p className="text-sm text-muted-foreground mb-3">Vil du støtte klubben uten å spille?</p><Button asChild variant="outline"><Link to="/bli-medlem">Bli støttemedlem</Link></Button></div></div></main><Footer/></div>;}