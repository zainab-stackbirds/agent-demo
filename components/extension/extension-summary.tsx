"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Bookmark, MapPin, List, Receipt } from "lucide-react";

interface ExtensionSummaryProps {
  heading: string;
  subheading: string;
  messages: string[];
}

interface BusinessProfileData {
  businessName: string;
  location: string;
  services: string;
  valueProp: string;
}

export const ExtensionSummary = ({ heading, subheading, messages }: ExtensionSummaryProps) => {
  // Mock data - in a real implementation, this would come from props or API
  const businessProfile: BusinessProfileData = {
    businessName: "Eat Cook Joy",
    location: "Texas",
    services: "Meal Prep, Events",
    valueProp: "Chef tool providing personalization + convenience + affordability",
  };

  const profileFields = [
    {
      label: "Business Name",
      value: businessProfile.businessName,
      icon: Bookmark,
    },
    {
      label: "Location",
      value: businessProfile.location,
      icon: MapPin,
    },
    {
      label: "Services",
      value: businessProfile.services,
      icon: List,
    },
    {
      label: "Value Prop",
      value: businessProfile.valueProp,
      icon: Receipt,
    },
  ];

  return (
    <div className="mb-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]">
        {heading}
      </h3>
      <Card className="border-primary/10 bg-gradient-to-br from-background/95 via-background to-muted/10 mt-0 p-2">
        <CardContent className="px-3 py-2 sm:px-4">
          <div className="space-y-3">
            {profileFields.map((field, index) => {
              const Icon = field.icon;
              return (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{field.label}</span>
                  </div>
                  <div className="flex-1 text-right">
                    <span className="text-sm text-foreground">
                      {field.value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
