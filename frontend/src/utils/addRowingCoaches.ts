import { supabase } from "@/integrations/supabase/client";

export const addRowingCoaches = async () => {
  const rowingCoaches = [
    {
      name: "Will Legenzowski",
      bio: "Professional rowing coach and co-founder of ProRowU. Specializes in conditioning and training programs for competitive coxswains and rowers. Extensive experience in developing fitness protocols and physical preparation strategies.",
      company: "ProRowU",
      email: "will@prorowu.com",
      hourly_rate: 100,
      locations: ["Available Anywhere"],
      specialties: ["Conditioning & Training"],
      availability: {},
      image_url: "",
      rating: null,
      total_reviews: 0,
      languages: ["English"],
      response_time_hours: 12,
      cancellation_policy: "Flexible cancellation up to 48 hours before session",
      session_types: ["Virtual", "In-person"],
      years_experience: 8,
      status: "active"
    },
    {
      name: "Henry Hollingsworth", 
      bio: "Co-founder of ProRowU with expertise in rowing conditioning and training methodologies. Focused on developing comprehensive fitness programs for competitive rowing athletes at all levels.",
      company: "ProRowU",
      email: "henry@prorowu.com", 
      hourly_rate: 100,
      locations: ["Available Anywhere"],
      specialties: ["Conditioning & Training"],
      availability: {},
      image_url: "",
      rating: null,
      total_reviews: 0,
      languages: ["English"],
      response_time_hours: 8,
      cancellation_policy: "Flexible cancellation up to 48 hours before session",
      session_types: ["Virtual", "In-person"],
      years_experience: 10,
      status: "active"
    },
    {
      name: "Honor Warburg",
      bio: "Elite pathway development specialist with extensive experience in college recruiting and national team pathways. Expert in guiding athletes through scholarship opportunities and competitive rowing career development.",
      company: "Independent Coach",
      email: "honor@rowingpathways.com",
      hourly_rate: 120,
      locations: ["Available Anywhere"], 
      specialties: ["Elite Pathway Development"],
      availability: {},
      image_url: "",
      rating: null,
      total_reviews: 0,
      languages: ["English", "French"],
      response_time_hours: 6,
      cancellation_policy: "48-hour cancellation policy required",
      session_types: ["Virtual", "In-person"],
      years_experience: 15,
      status: "active"
    }
  ];

  // Check if coaches already exist
  const { data: existingCoaches } = await supabase
    .from('coaches')
    .select('name')
    .in('name', rowingCoaches.map(c => c.name));

  // Only insert coaches that don't exist
  const coachesToInsert = rowingCoaches.filter(
    coach => !existingCoaches?.some(existing => existing.name === coach.name)
  );

  if (coachesToInsert.length === 0) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('coaches')
      .insert(coachesToInsert)
      .select();

    if (error) {
      console.error('Error adding coaches:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to add coaches:', error);
    throw error;
  }
};