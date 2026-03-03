import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, FileText } from 'lucide-react-native';

const Section = ({ title, children }: { title: string; children: string }) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {title}
    </Text>
    <Text style={{ color: '#C4C4E0', fontSize: 14, lineHeight: 22 }}>{children}</Text>
  </View>
);

const Terms = () => {
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
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={18} color="#3B82F6" />
        </View>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Terms & Conditions</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: '#64648F', fontSize: 12, marginBottom: 24 }}>
          Last updated: March 2026
        </Text>

        <Section title="Acceptance of Terms">
          {`By creating an account or using Zu.Chat, you agree to these Terms and Conditions. If you do not agree, please do not use the app.\n\nWe may update these terms at any time. Continued use of the app after changes means you accept the updated terms.`}
        </Section>

        <Section title="Eligibility">
          {`You must be at least 13 years old to use Zu.Chat. By using the app, you confirm you meet this age requirement.\n\nIf you are under 18, you should have parental consent to use this service.`}
        </Section>

        <Section title="Acceptable Use">
          {`You agree NOT to use Zu.Chat to:\n• Share illegal, abusive, threatening, or hateful content\n• Harass, bully, or harm other users\n• Share explicit or adult content\n• Impersonate other people\n• Spam or send unsolicited messages\n• Attempt to hack, disrupt, or abuse the service\n• Share personal information of others without consent`}
        </Section>

        <Section title="Anonymous Nature">
          {`Zu.Chat is designed for anonymous conversations. You are responsible for the nickname you choose and the content you share.\n\nAnonymity does not exempt you from these terms or applicable laws. We reserve the right to investigate and take action against abuse.`}
        </Section>

        <Section title="Content Responsibility">
          {`You are solely responsible for all content you send through Zu.Chat. We do not endorse, verify, or take responsibility for user-generated content.\n\nRandom chat messages are temporary. Friend chat messages may be stored. Do not share sensitive personal information with strangers.`}
        </Section>

        <Section title="Account Termination">
          {`We reserve the right to suspend or delete accounts that violate these terms, without notice.\n\nYou can delete your own account at any time from Settings. Deletion is permanent.`}
        </Section>

        <Section title="Service Availability">
          {`Zu.Chat is provided "as is." We do not guarantee uninterrupted availability. We may modify, suspend, or discontinue the service at any time without liability.\n\nWe are not responsible for messages lost due to technical issues, server downtime, or app errors.`}
        </Section>

        <Section title="Limitation of Liability">
          {`To the maximum extent permitted by law, Zu.Chat and its developers are not liable for:\n• Any harm resulting from interactions with other users\n• Loss of data or messages\n• Technical failures or service interruptions\n• Any indirect, incidental, or consequential damages`}
        </Section>

        <Section title="Intellectual Property">
          {`The Zu.Chat name, logo, and app design are the property of the developers. You may not copy, reproduce, or distribute them without permission.\n\nYou retain ownership of content you create. By using the app, you grant us a limited license to process and transmit your content as needed to operate the service.`}
        </Section>

        <Section title="Governing Law">
          {`These terms are governed by applicable laws. Any disputes shall be resolved through good-faith negotiation first.`}
        </Section>

        <Text style={{ color: '#3A3A5C', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Zu.Chat — Anonymous Chat, Real Connections
        </Text>
      </ScrollView>
    </View>
  );
};

export default Terms;
