import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield } from 'lucide-react-native';

const Section = ({ title, children }: { title: string; children: string }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {title}
    </Text>
    <Text style={{ color: '#C4C4E0', fontSize: 14, lineHeight: 22 }}>{children}</Text>
  </View>
);

const PrivacyPolicy = () => {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0F2D', paddingTop: 16 }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, marginBottom: 20, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={18} color="#10B981" />
        </View>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Privacy Policy</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: '#64648F', fontSize: 12, marginBottom: 24 }}>
          Last updated: March 2026
        </Text>

        <Section title="Overview">
          {`Zu.Chat is an anonymous chat application. We are committed to protecting your privacy. This policy explains what data we collect, how we use it, and how we keep it safe.\n\nBy using Zu.Chat, you agree to the practices described in this policy.`}
        </Section>

        <Section title="What We Collect">
          {`• Username (nickname you choose — not your real name)\n• Gender preference (optional, used for matching)\n• Bio and interests (optional, shown to chat partners)\n• Profile picture (optional, stored securely)\n• Device push token (for notifications, optional)\n• Chat messages (random chats are stored temporarily; friend chats are stored persistently)\n• Connection metadata (IP address, timestamps — for security and anti-abuse)`}
        </Section>

        <Section title="How We Use Your Data">
          {`• To match you with random chat partners\n• To enable messaging between friends\n• To send push notifications (if you opt in)\n• To protect against abuse, spam, and violations\n• We do NOT sell your data to third parties\n• We do NOT use your data for advertising`}
        </Section>

        <Section title="Anonymous Accounts">
          {`Zu.Chat accounts are fully anonymous. We do not require your real name, email address, or phone number. Your nickname is the only identifier visible to other users.\n\nHowever, your IP address and device information are logged for security purposes.`}
        </Section>

        <Section title="Data Storage">
          {`• Random chat messages are stored temporarily in memory (Redis) and deleted when the chat ends\n• Friend chat messages are stored in our database\n• Profile data (username, bio, interests, picture) is stored in our database\n• All data is stored on secured servers`}
        </Section>

        <Section title="Data Deletion">
          {`You can delete your account at any time from Settings → Delete Account. This permanently deletes:\n• Your profile and all associated data\n• All friend chat history\n• Your friend connections\n\nDeletion is immediate and irreversible.`}
        </Section>

        <Section title="Third-Party Services">
          {`We use the following third-party services:\n• Expo (push notifications)\n• Cloud storage provider (profile pictures)\n\nThese services have their own privacy policies.`}
        </Section>

        <Section title="Your Rights">
          {`• You can update your profile at any time\n• You can delete your account at any time\n• You can opt out of push notifications in your device settings\n• You can contact us with privacy concerns`}
        </Section>

        <Section title="Contact">
          {`If you have questions about this privacy policy, please reach out through the app's feedback channel or contact the development team.`}
        </Section>

        <Text style={{ color: '#3A3A5C', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Zu.Chat — Anonymous Chat, Real Connections
        </Text>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicy;
