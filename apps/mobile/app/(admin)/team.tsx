import { useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useQuery } from "@tanstack/react-query";

import {
  Search,
  Plus,
  Users,
  Mail,
  Phone,
  CalendarDays,
  Clock3,
  ChevronLeft,
  ChevronRight,
  X,
  UserRound,
} from "lucide-react-native";
import { router } from "expo-router";

import { ScreenContainer } from "../../src/components/ui/ScreenContainer";
import { AppInput } from "../../src/components/ui/AppInput";
import { AppButton } from "../../src/components/ui/AppButton";

import {
  getTechnicians,
  getTechnician,
  type Technician,
} from "../../src/lib/technicians-api";

import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

const PAGE_SIZE = 10;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null): string {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TeamScreen() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTechnician, setSelectedTechnician] =
    useState<Technician | null>(null);

  const techniciansQuery = useQuery({
    queryKey: ["technicians", page, search],
    queryFn: () =>
      getTechnicians({
        page,
        limit: PAGE_SIZE,
        search: search.trim(),
      }),
  });

  const selectedId = selectedTechnician?.id;

  const detailQuery = useQuery({
    queryKey: ["technician", selectedId],
    queryFn: () => {
      if (!selectedId) {
        throw new Error("Technician ID is missing");
      }

      return getTechnician(selectedId);
    },
    enabled: Boolean(selectedId),
  });

  const technicians = techniciansQuery.data?.items ?? [];
  const pagination = techniciansQuery.data?.pagination;

  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleAddTechnician = () => {
    router.push("/(admin)/team-create");
  };

  const handleRefresh = async () => {
    await techniciansQuery.refetch();
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ORGANIZATION</Text>
          <Text style={styles.title}>Team</Text>
          <Text style={styles.subtitle}>
            Manage your technician accounts and access.
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Users size={25} color={colors.primary} />
        </View>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Users size={23} color={colors.white} />
        </View>

        <View style={styles.summaryContent}>
          <Text style={styles.summaryLabel}>TOTAL TECHNICIANS</Text>
          <Text style={styles.summaryValue}>{pagination?.total ?? "—"}</Text>
        </View>

        <Pressable onPress={handleAddTechnician} style={styles.addButton}>
          <Plus size={19} color={colors.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <Search size={19} color={colors.textSecondary} />

        <View style={styles.searchInput}>
          <AppInput
            label="Search technicians"
            placeholder="Name, email or mobile"
            value={search}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>All technicians</Text>
          <Text style={styles.sectionSubtitle}>
            {pagination
              ? `${pagination.total} technician accounts`
              : "Loading technician accounts"}
          </Text>
        </View>

        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={techniciansQuery.isFetching}
        >
          {techniciansQuery.isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.refreshText}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {techniciansQuery.isPending ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading technicians...</Text>
        </View>
      ) : techniciansQuery.isError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load technicians</Text>

          <Text style={styles.errorText}>
            {techniciansQuery.error instanceof Error
              ? techniciansQuery.error.message
              : "Something went wrong. Please try again."}
          </Text>

          <AppButton
            title="Try again"
            onPress={() => void techniciansQuery.refetch()}
          />
        </View>
      ) : technicians.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Users size={30} color={colors.primary} />
          </View>

          <Text style={styles.emptyTitle}>
            {search.trim() ? "No technicians found" : "No technicians yet"}
          </Text>

          <Text style={styles.emptyText}>
            {search.trim()
              ? "Try another name, email or mobile number."
              : "Add your first technician to get started."}
          </Text>

          {!search.trim() && (
            <AppButton title="Add technician" onPress={handleAddTechnician} />
          )}
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={
                  techniciansQuery.isFetching && !techniciansQuery.isPending
                }
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {technicians.map((technician) => (
              <Pressable
                key={technician.id}
                onPress={() => setSelectedTechnician(technician)}
                style={({ pressed }) => [
                  styles.technicianCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.technicianTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitials(technician.fullName)}
                    </Text>
                  </View>

                  <View style={styles.technicianInfo}>
                    <Text style={styles.technicianName} numberOfLines={1}>
                      {technician.fullName}
                    </Text>

                    <Text style={styles.technicianEmail} numberOfLines={1}>
                      {technician.email}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      technician.isActive
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: technician.isActive
                            ? colors.success
                            : colors.danger,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: technician.isActive
                            ? colors.success
                            : colors.danger,
                        },
                      ]}
                    >
                      {technician.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.technicianBottom}>
                  <View style={styles.mobileInfo}>
                    <Phone size={14} color={colors.textSecondary} />
                    <Text style={styles.mobileText}>
                      {technician.mobile || "No mobile"}
                    </Text>
                  </View>

                  <Text style={styles.viewDetails}>View details →</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.pagination}>
            <Text style={styles.paginationText}>
              Page {pagination?.page ?? page} of {totalPages}
            </Text>

            <View style={styles.paginationActions}>
              <Pressable
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                style={[
                  styles.pageButton,
                  page <= 1 && styles.pageButtonDisabled,
                ]}
              >
                <ChevronLeft
                  size={19}
                  color={page <= 1 ? colors.textSecondary : colors.primary}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                style={[
                  styles.pageButton,
                  page >= totalPages && styles.pageButtonDisabled,
                ]}
              >
                <ChevronRight
                  size={19}
                  color={
                    page >= totalPages ? colors.textSecondary : colors.primary
                  }
                />
              </Pressable>
            </View>
          </View>
        </>
      )}

      <Modal
        visible={Boolean(selectedTechnician)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTechnician(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Technician details</Text>

              <Pressable
                onPress={() => setSelectedTechnician(null)}
                style={styles.closeButton}
              >
                <X size={20} color={colors.text} />
              </Pressable>
            </View>

            {detailQuery.isPending ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : detailQuery.isError ? (
              <View style={styles.modalLoading}>
                <Text style={styles.errorText}>
                  {detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : "Unable to load technician details."}
                </Text>

                <AppButton
                  title="Retry"
                  onPress={() => void detailQuery.refetch()}
                />
              </View>
            ) : detailQuery.data ? (
              <>
                <TechnicianDetails technician={detailQuery.data} />

                <Pressable
                  style={styles.manageButton}
                  onPress={() => {
                    const technicianId = selectedId;
                    setSelectedTechnician(null);

                    if (technicianId) {
                      router.push({
                        pathname: "/(admin)/team-manage",
                        params: { id: technicianId },
                      });
                    }
                  }}
                >
                  <Text style={styles.manageButtonText}>Manage Technician</Text>
                </Pressable>
              </>
            ) : null}

            <AppButton
              title="Close"
              variant="secondary"
              onPress={() => setSelectedTechnician(null)}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function TechnicianDetails({ technician }: { technician: Technician }) {
  return (
    <View style={styles.detailsContent}>
      <View style={styles.detailProfile}>
        <View style={styles.detailAvatar}>
          <Text style={styles.detailAvatarText}>
            {getInitials(technician.fullName)}
          </Text>
        </View>

        <Text style={styles.detailName}>{technician.fullName}</Text>

        <Text style={styles.detailRole}>Technician</Text>

        <View
          style={[
            styles.statusBadge,
            technician.isActive ? styles.activeBadge : styles.inactiveBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: technician.isActive ? colors.success : colors.danger,
              },
            ]}
          >
            {technician.isActive ? "Active account" : "Inactive account"}
          </Text>
        </View>
      </View>

      <DetailRow
        icon={<Mail size={18} color={colors.textSecondary} />}
        label="Email"
        value={technician.email}
      />

      <DetailRow
        icon={<Phone size={18} color={colors.textSecondary} />}
        label="Mobile"
        value={technician.mobile || "Not provided"}
      />

      <DetailRow
        icon={<CalendarDays size={18} color={colors.textSecondary} />}
        label="Account created"
        value={formatDate(technician.createdAt)}
      />

      <DetailRow
        icon={<Clock3 size={18} color={colors.textSecondary} />}
        label="Last login"
        value={formatDate(technician.lastLoginAt)}
      />
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailRowIcon}>{icon}</View>

      <View style={styles.detailRowContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryIcon: {
    width: 45,
    height: 45,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF25",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    color: "#D8E4FF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 3,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF25",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    gap: 10,
  },
  searchInput: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  centerState: {
    padding: 35,
    alignItems: "center",
    gap: 12,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  list: {
    flexGrow: 0,
    maxHeight: 470,
  },
  listContent: {
    gap: 12,
    paddingBottom: 5,
  },
  technicianCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 13,
  },
  pressed: {
    opacity: 0.75,
  },
  technicianTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  technicianInfo: {
    flex: 1,
    gap: 4,
  },
  technicianName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  technicianEmail: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
  },
  inactiveBadge: {
    backgroundColor: colors.dangerLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  technicianBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mobileInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mobileText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  viewDetails: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 5,
  },
  paginationText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  paginationActions: {
    flexDirection: "row",
    gap: 8,
  },
  pageButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  emptyCard: {
    padding: 25,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    padding: 18,
    borderRadius: radius.lg,
    gap: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#00000070",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 22,
    paddingBottom: 30,
    gap: 18,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLoading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
  },
  detailsContent: {
    gap: 15,
  },
  detailProfile: {
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
  },
  detailAvatar: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "800",
  },
  detailName: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
  },
  detailRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowContent: {
    flex: 1,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },

  manageButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  manageButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
