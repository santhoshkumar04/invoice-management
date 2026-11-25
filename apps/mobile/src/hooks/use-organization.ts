import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOrganization,
  updateOrganization,
  type Organization,
  type UpdateOrganizationInput,
} from "../lib/organizations-api";

export const organizationKeys = {
  all: ["organization"] as const,
  profile: () => [...organizationKeys.all, "profile"] as const,
};

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.profile(),
    queryFn: getOrganization,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      updateOrganization(input),

    onSuccess: async (organization: Organization) => {
      queryClient.setQueryData(
        organizationKeys.profile(),
        organization,
      );

      await queryClient.invalidateQueries({
        queryKey: organizationKeys.profile(),
      });
    },
  });
}
