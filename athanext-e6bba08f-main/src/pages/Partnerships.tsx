import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SOCCER_THEME, ROWING_BLUE_THEME } from "@/config/colors";

import { Loader2, ShoppingCart, Info, Filter } from "lucide-react";
import { PartnershipPreviewModal } from "@/components/PartnershipPreviewModal";
import { cn } from "@/lib/utils";
import { capitalize } from "@/utils/helperFunctions";
import { usePartnerships } from "@/hooks/usePartnerships";
import { useAuth } from "@/hooks/useAuth";
import { usePartnershipInquirySubmission } from "@/hooks/usePartnershipInquirySubmission";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { PartnershipStatus } from "@/api/endpoints/partnerships";
import footballIcon from "../assets/images/colored-soccer.png";
import rowerIcon from "../assets/images/colored-rowing.png";

const pastelColors = [
  { bg: "bg-pastel-blue", text: "text-pastel-blue-foreground" },
  { bg: "bg-pastel-green", text: "text-pastel-green-foreground" },
  { bg: "bg-pastel-yellow", text: "text-pastel-yellow-foreground" },
  { bg: "bg-pastel-purple", text: "text-pastel-purple-foreground" },
  { bg: "bg-pastel-pink", text: "text-pastel-pink-foreground" },
];

const getSportBadgeStyle = (sportType: string | null) => {
  if (!sportType) return {};
  
  const sport = sportType.toLowerCase();
  if (sport === 'soccer') {
    return {
      backgroundColor: SOCCER_THEME.primary,
      color: SOCCER_THEME.primaryForeground,
      borderColor: SOCCER_THEME.primary,
    };
  }
  if (sport === 'rowing') {
    return {
      backgroundColor: ROWING_BLUE_THEME.primary,
      color: ROWING_BLUE_THEME.primaryText,
      borderColor: ROWING_BLUE_THEME.primary,
    };
  }
  return {};
};

const Partnerships = () => {
  const { partnerships, isLoading, error } = usePartnerships();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { submitInquiry, isSubmitting } = usePartnershipInquirySubmission();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [selectedPartnership, setSelectedPartnership] = useState<typeof partnerships[0] | null>(null);
  const [sportFilter, setSportFilter] = useState<'all' | 'soccer' | 'rowing'>('all');
  const [formData, setFormData] = useState({
    name: "",
    organization: "",
    email: "",
    partnershipInterest: "",
  });

  // Scroll to Resource Marketplace when navigated from coach discovery
  useEffect(() => {
    if ((location.state as any)?.scrollTo === "resource-marketplace") {
      const timer = setTimeout(() => {
        const marketplaceSection = document.querySelector('h2');
        if (marketplaceSection && marketplaceSection.textContent?.includes('Resource Marketplace')) {
          marketplaceSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handlePurchase = async (partnership: typeof partnerships[0]) => {
    if (!user) {
      toast.error("Please sign in to purchase resources");
      navigate("/auth");
      return;
    }

    try {
      setPurchasingId(partnership.id);

      const { data, error } = await supabase.functions.invoke(
        "create-partnership-payment",
        {
          body: { partnershipId: partnership.id },
        }
      );

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Error creating partnership payment:", error);
      toast.error("Failed to create payment session. Please try again.");
      setPurchasingId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const success = await submitInquiry(formData);
    if (!success) return;

    setFormData({
      name: "",
      organization: "",
      email: "",
      partnershipInterest: "",
    });
  };

  const filteredPartnerships = partnerships.filter((partnership) => {
    if (sportFilter === 'all') return true;
    return partnership.sport_type?.toLowerCase() === sportFilter;
  });

  const hasSoccerResources = partnerships.some(
    (partnership) => partnership.sport_type?.toLowerCase() === "soccer"
  );
  const hasRowingResources = partnerships.some(
    (partnership) => partnership.sport_type?.toLowerCase() === "rowing"
  );

  const getEmptyMarketplaceMessage = () => {
    if (sportFilter === "soccer") {
      return "Soccer resources will be available soon.";
    }
    if (sportFilter === "rowing") {
      return "Rowing resources will be available soon.";
    }
    if (!hasSoccerResources && !hasRowingResources) {
      return "Resources will be available soon.";
    }
    if (!hasSoccerResources) {
      return "Soccer resources will be available soon.";
    }
    if (!hasRowingResources) {
      return "Rowing resources will be available soon.";
    }
    return "Resources will be available soon.";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-100/40 via-blue-50/30 to-slate-100/20 dark:from-blue-900/40 dark:via-blue-800/30 dark:to-slate-900/20 pt-24 pb-12 px-4 border-b border-primary/20" aria-labelledby="resources-hero-heading">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative container mx-auto max-w-6xl text-center px-0 sm:px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-slate-800 dark:text-slate-200">Specialized </span>
            <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Resources</span>
          </h1>
          <p className="text-lg text-slate-700 dark:text-slate-300 max-w-3xl mx-auto">
            Discover tools and services that empower athletes, coaches, and teams to reach their full potential. Our specialized resources bring cutting-edge solutions to the AthaNext ecosystem.
          </p>
        </div>
      </section>

      {/* Partnership Marketplace */}
      <section className="py-12 px-4 bg-gradient-to-b from-background to-blue-500/5">
        <div className="container mx-auto max-w-6xl px-0 sm:px-4">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-8 text-center">
            Resource Marketplace
          </h2>

          {/* Sport Filters */}
          <div className="flex flex-col items-center gap-3 mb-8 sm:flex-row sm:justify-center sm:gap-4">
            <div className="flex items-center justify-center gap-2 text-base text-muted-foreground sm:text-sm">
              <Filter className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="font-medium">Filter by Sport:</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant={sportFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSportFilter('all')}
                className="rounded-full"
              >
                All Sports
              </Button>
              <Button
                variant={sportFilter === 'soccer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSportFilter('soccer')}
                className="rounded-full flex items-center gap-2"
                style={sportFilter === 'soccer' ? {
                  backgroundColor: SOCCER_THEME.primary,
                  color: SOCCER_THEME.primaryForeground,
                  borderColor: SOCCER_THEME.primary,
                } : {}}
              >
                <img src={footballIcon} alt="Soccer" className="w-4 h-4" />
                Soccer
              </Button>
              <Button
                variant={sportFilter === 'rowing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSportFilter('rowing')}
                className="rounded-full flex items-center gap-2"
                style={sportFilter === 'rowing' ? {
                  backgroundColor: ROWING_BLUE_THEME.primary,
                  color: ROWING_BLUE_THEME.primaryText,
                  borderColor: ROWING_BLUE_THEME.primary,
                } : {}}
              >
                <img src={rowerIcon} alt="Rowing" className="w-4 h-4" />
                Rowing
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-destructive">Error loading resources: {error}</p>
            </div>
          ) : (
            filteredPartnerships.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground text-lg">
                  {getEmptyMarketplaceMessage()}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPartnerships.map((partnership, index) => {
                  const colorScheme = pastelColors[index % pastelColors.length];
                  return (
                    <Card 
                      key={partnership.id} 
                      className={cn(
                        "flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 cursor-pointer",
                        colorScheme.bg
                      )}
                      onClick={() => setSelectedPartnership(partnership)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <CardTitle className={cn("text-xl", colorScheme.text)}>
                            {partnership.name}
                          </CardTitle>
                          {partnership.sport_type && (
                            <Badge 
                              variant="outline" 
                              className="text-xs font-semibold border-0 shrink-0"
                              style={getSportBadgeStyle(partnership.sport_type)}
                            >
                              {capitalize(partnership.sport_type)}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className={cn("text-sm", colorScheme.text)}>
                          {partnership.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2 justify-between mb-3">
                         
                          <Badge 
                            variant={partnership.status === PartnershipStatus.AVAILABLE_NOW
                              
                              ? "default" : "secondary"}
                          >
                            {partnership.status}
                          </Badge>

                           
                        </div>
                        {partnership.status === PartnershipStatus.AVAILABLE_NOW && (
                          <div className={cn("text-xl font-semibold", colorScheme.text)}>
                            ${(partnership.price / 100).toFixed(2)}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="mt-auto flex flex-col md:flex-row gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPartnership(partnership);
                          }}
                          variant="outline"
                          className="w-full md:flex-1 text-xs md:text-sm whitespace-nowrap px-2 md:px-4"
                        >
                          <Info className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                          Learn More
                        </Button>
                        {partnership.status === PartnershipStatus.AVAILABLE_NOW ? (
                          <Button 
                            className="w-full md:flex-1 bg-foreground text-background hover:bg-foreground/90 text-xs md:text-sm whitespace-nowrap px-2 md:px-4" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePurchase(partnership);
                            }}
                            disabled={purchasingId === partnership.id}
                          >
                            {purchasingId === partnership.id ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                                Purchase Now
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button 
                            className="w-full md:flex-1 bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30" 
                            disabled
                            onClick={(e) => e.stopPropagation()}
                          >
                            Get Updates
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )
          )}
        </div>
      </section>

      {/* Footer CTA - Resource Inquiry Form */}
      <footer className="py-16 px-4 bg-gradient-to-br from-primary/10 to-blue-500/10 border-t border-primary/20">
        <div className="container mx-auto max-w-4xl px-0 sm:px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              Interested in Offering a Resource?
            </h2>
            <p className="text-slate-700 dark:text-slate-300">
              Join our network of specialized resource providers. Fill out the form below and we'll get back to you to discuss partnership opportunities.
            </p>
          </div>
          
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Your full name"
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Input
                      id="organization"
                      name="organization"
                      type="text"
                      value={formData.organization}
                      onChange={handleInputChange}
                      placeholder="Company or organization name"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="partnershipInterest">What resource would you like to offer?</Label>
                  <Textarea
                    id="partnershipInterest"
                    name="partnershipInterest"
                    value={formData.partnershipInterest}
                    onChange={handleInputChange}
                    placeholder="Tell us about your resource and how it can help athletes and coaches..."
                    rows={4}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Inquiry"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </footer>

      {/* Partnership Preview Modal */}
      {selectedPartnership && (
        <PartnershipPreviewModal
          partnership={selectedPartnership}
          open={!!selectedPartnership}
          onClose={() => setSelectedPartnership(null)}
          onPurchase={(partnership) => {
            setSelectedPartnership(null);
            handlePurchase(partnership);
          }}
        />
      )}
    </div>
  );
};

export default Partnerships;
