import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="invoice-create" />
      <Stack.Screen name="invoice-edit" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="customer/[id]" />
      <Stack.Screen name="customer-create" />
      <Stack.Screen name="customer-edit" />
      <Stack.Screen name="team" />
      <Stack.Screen name="team-create" />
      <Stack.Screen name="team-manage" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}
