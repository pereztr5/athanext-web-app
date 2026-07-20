import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, CheckCircle } from "lucide-react";

interface Certification {
  id: string;
  certification_name: string;
  issuing_organization?: string;
}

interface CertificationsSectionProps {
  certifications?: Certification[];
  iconColor: string;
  certBg: string;
  certIcon: string;
}

export function CertificationsSection({ 
  certifications, 
  iconColor,
  certBg,
  certIcon 
}: CertificationsSectionProps) {
  return (
    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className={`h-5 w-5 ${iconColor}`} />
          Certifications & Credentials
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {certifications && certifications.length > 0 ? (
            certifications.map((cert) => (
              <div 
                key={cert.id} 
                className={`flex items-start gap-3 p-3 ${certBg} rounded-lg`}
              >
                <CheckCircle className={`h-5 w-5 ${certIcon} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">{cert.certification_name}</span>
                  {cert.issuing_organization && (
                    <span className="text-xs text-muted-foreground block truncate">
                      {cert.issuing_organization}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={`flex items-center gap-3 p-3 ${certBg} rounded-lg`}>
              <CheckCircle className={`h-5 w-5 ${certIcon}`} />
              <span className="text-sm font-medium">Professional Certified</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
