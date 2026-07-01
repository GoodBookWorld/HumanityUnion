export interface PublicParticipationVisibility {
  displayName: boolean;
  languages: boolean;
  interestedTopics: boolean;
  volunteerInterests: boolean;
  preferredParticipationRegions: boolean;
}

export const bootstrapPublicParticipationVisibility: PublicParticipationVisibility = {
  displayName: true,
  languages: true,
  interestedTopics: true,
  volunteerInterests: true,
  preferredParticipationRegions: true,
};
