import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { strings } from "@/config/strings";
import { useState } from "react";
import { useFAQs } from "@/hooks/useFAQs";
import { useRole } from "@/hooks/useRole";
import { WHY_MYKONNECT_STRINGS } from "@/utils/db";
import { ROUTES } from "@/routes";
import { 
  Database, 
  Target, 
  CheckCircle2,
  User,
  Users,
  CreditCard,
  TrendingUp,
  Trophy,
  AlertCircle
} from "lucide-react";

const MAX_VISIBLE_FAQS = 7;

const WhyMyKonnect = () => {
  const navigate = useNavigate();
  const { faqs, loading, error, hasFAQs, source } = useFAQs();
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const { role, isCoach, isAthleteLike } = useRole();

  const handleBeginTraining = () => {
    if (!role) {
      // Not logged in, navigate to signup
      navigate(ROUTES.AUTH + '?mode=signup');
    } else {
      // Logged in as athlete, navigate to coaches
      navigate(ROUTES.COACHES);
    }
  };

  const handleBeginCoaching = () => {
    if (!role) {
      // Not logged in, navigate to signup with coach persona preselected
      navigate(ROUTES.AUTH + '?mode=signup&persona=coach');
    } else if (isCoach) {
      // Logged in as coach, navigate to their profile
      navigate(ROUTES.PROFILE);
    }
  };

  // Map strings with icons for differentiators
  const differentiators = WHY_MYKONNECT_STRINGS.differentiators.map((item, index) => {
    const icons = [
      <Target className="w-8 h-8" />,
      <TrendingUp className="w-8 h-8" />,
      <Database className="w-8 h-8" />,
      <CreditCard className="w-8 h-8" />
    ];
    return {
      icon: icons[index],
      title: item.title,
      description: item.description,
      gradient: "from-primary/5 to-blue-500/5",
      borderColor: "border-primary/20",
      iconGradient: "from-primary to-blue-600"
    };
  });

  const athleteBenefits = WHY_MYKONNECT_STRINGS.athleteSection.benefits;
  const coachBenefits = WHY_MYKONNECT_STRINGS.coachSection.benefits;

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-blue-50 via-slate-50/30 to-slate-100/20 dark:from-blue-900 dark:via-slate-950/30 dark:to-slate-950/20">
      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-100/40 via-blue-50/30 to-slate-100/20 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-slate-900/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-8 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-slate-800 dark:text-slate-200">
              Why <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">{strings.brand.name}</span>
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-foreground mb-4">
              {WHY_MYKONNECT_STRINGS.hero.subtitle}
            </p>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              {WHY_MYKONNECT_STRINGS.hero.description}
            </p>
          </div>

          {/* Value Proposition Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="mb-3 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <div className="text-lg font-bold text-foreground mb-2">{WHY_MYKONNECT_STRINGS.valueProposition[0].title}</div>
                <div className="text-sm text-muted-foreground">{WHY_MYKONNECT_STRINGS.valueProposition[0].description}</div>
              </CardContent>
            </Card>
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="mb-3 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div className="text-lg font-bold text-foreground mb-2">{WHY_MYKONNECT_STRINGS.valueProposition[1].title}</div>
                <div className="text-sm text-muted-foreground">{WHY_MYKONNECT_STRINGS.valueProposition[1].description}</div>
              </CardContent>
            </Card>
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="mb-3 mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="text-lg font-bold text-foreground mb-2">{WHY_MYKONNECT_STRINGS.valueProposition[2].title}</div>
                <div className="text-sm text-muted-foreground">{WHY_MYKONNECT_STRINGS.valueProposition[2].description}</div>
              </CardContent>
            </Card>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* Show "Begin Training" for non-logged in users and athletes */}
            {(!role || isAthleteLike) && (
              <Button 
                size="lg" 
                onClick={handleBeginTraining}
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                View Coaches
              </Button>
            )}
            {/* Show "Begin Coaching" for non-logged in users and coaches */}
            {(!role || isCoach) && (
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleBeginCoaching}
                className="text-lg px-8 py-6 border-2 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              >
                Begin Coaching
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-800 dark:text-slate-200">{WHY_MYKONNECT_STRINGS.whatMakesUsDifferent.title}</h2>
            <p className="text-xl sm:text-2xl text-foreground mb-4">
              {WHY_MYKONNECT_STRINGS.whatMakesUsDifferent.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {differentiators.map((item, index) => (
              <Card 
                key={index}
                className={`border ${item.borderColor} bg-gradient-to-br ${item.gradient} backdrop-blur-sm hover:border-primary/30 transition-all duration-300 animate-fade-in`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.iconGradient} flex items-center justify-center mb-4`}>
                    <div className="text-white">
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Audience Columns */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-secondary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-800 dark:text-slate-200">{WHY_MYKONNECT_STRINGS.builtForEveryone.title}</h2>
            <p className="text-xl sm:text-2xl text-foreground mb-4">
              {WHY_MYKONNECT_STRINGS.builtForEveryone.subtitle}
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* For Athletes & Families */}
            <Card className="border border-primary/20 hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-primary/5 to-blue-500/5 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-6">{WHY_MYKONNECT_STRINGS.athleteSection.title}</h3>
                <ul className="space-y-4 mb-8">
                  {athleteBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full sm:w-auto"
                  onClick={() => navigate('/coaches')}
                >
                  Browse Coaches
                </Button>
              </CardContent>
            </Card>

            {/* For Coaches */}
            <Card className="border border-primary/20 hover:border-primary/30 transition-all duration-300 bg-gradient-to-br from-primary/5 to-blue-500/5 backdrop-blur-sm">
              <CardContent className="p-4 sm:p-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mb-6">
                  <User className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-6">{WHY_MYKONNECT_STRINGS.coachSection.title}</h3>
                <ul className="space-y-4 mb-8">
                  {coachBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto border-2"
                  disabled={isCoach}
                  onClick={() => navigate('/become-a-coach')}
                >
                  Apply to Coach
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background to-primary/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-800 dark:text-slate-200">{WHY_MYKONNECT_STRINGS.faqSection.title}</h2>
            <p className="text-lg text-muted-foreground">
              {WHY_MYKONNECT_STRINGS.faqSection.subtitle}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="border border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900">Unable to load FAQs</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && !hasFAQs && !error && (
            <Card className="border border-yellow-200 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-yellow-900">No FAQs available</p>
                    <p className="text-sm text-yellow-700">Please check back later for frequently asked questions.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FAQs Content */}
          {!loading && hasFAQs && (
            <Card className="border border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {(faqs ?? [])
                    .slice(0, showAllFaqs ? faqs?.length : MAX_VISIBLE_FAQS)
                    .map((faq, index) => (
                    <AccordionItem key={faq.id || index} value={`item-${faq.id || index}`}>
                      <AccordionTrigger className="text-left font-semibold hover:text-primary transition-colors">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                {faqs && faqs.length > MAX_VISIBLE_FAQS && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="ghost"
                      className="rounded-full border border-slate-200 px-6"
                      onClick={() => setShowAllFaqs((prev) => !prev)}
                    >
                      {showAllFaqs ? "Show Fewer Questions" : `Show All FAQs (${faqs.length})`}
                    </Button>
                  </div>
                )}
                {/* {source && (
                  <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                    Source: {source === 'database' ? 'Live database' : 'Default content'}
                  </p>
                )} */}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Final CTA Banner (hide for coaches) */}
      {role !== 'coach' && (
        <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 to-secondary/10">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-slate-800 dark:text-slate-200">
              {WHY_MYKONNECT_STRINGS.finalCta.title}
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              {WHY_MYKONNECT_STRINGS.finalCta.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/coaches')}
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {WHY_MYKONNECT_STRINGS.finalCta.primaryButton}
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/become-a-coach')}
                className="text-lg px-8 py-6 border-2 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              >
                {WHY_MYKONNECT_STRINGS.finalCta.secondaryButton}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default WhyMyKonnect;
