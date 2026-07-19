import { Card, CardContent } from "@/components/ui/card";
import { ATHLETE_BENEFITS, COACH_BENEFITS } from "@/constants/landingPage";
import { strings } from "@/config/strings";

export const AdvantagesSection = () => {
  return (
    <section 
      data-section="advantages"
      className="py-16 bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 dark:from-slate-900 dark:via-purple-900/30 dark:to-slate-800" 
      aria-labelledby="advantages-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-fade-in">
          <h2 
            id="advantages-heading"
            className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4"
          >
            <span className="text-primary">{strings.brand.name}</span> Advantages
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover why athletes and coaches choose {strings.brand.name} to elevate their performance and build successful careers
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* For Athletes */}
          <div className="animate-fade-in">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-0 shadow-lg h-full">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-lg">A</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">For Athletes</h3>
                    <p className="text-muted-foreground">Accelerate your performance</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {ATHLETE_BENEFITS.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <benefit.icon className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-foreground">{benefit.title}</h4>
                        <p className="text-sm text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* For Coaches */}
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-0 shadow-lg h-full">
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mr-4">
                    <span className="text-white font-bold text-lg">C</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">For Coaches</h3>
                    <p className="text-muted-foreground">Build your coaching empire</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {COACH_BENEFITS.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <benefit.icon className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-foreground">{benefit.title}</h4>
                        <p className="text-sm text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
