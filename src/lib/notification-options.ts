const householdTopics = ["upcoming", "posted", "budget", "monthly", "mention"] as const;
export type HouseholdTopic = typeof householdTopics[number];
export const notificationTopics = [...householdTopics, "invitation"] as const;
export type NotificationTopic = typeof notificationTopics[number];
export const deliveryChannels = ["email", "push"] as const;
export type DeliveryChannel = typeof deliveryChannels[number];

export const topicLabels: Record<NotificationTopic, string> = {
  upcoming: "Upcoming bills and income",
  posted: "Recurring entries posted",
  budget: "Budget threshold alerts",
  monthly: "Monthly household digest",
  mention: "Comments mentioning you",
  invitation: "Tracker invitations (all households)",
};

export type NotificationOptions = {
  emailVerified: boolean;
  preview: boolean;
  choices: { topic: NotificationTopic; label: string; email: boolean; push: boolean }[];
};
