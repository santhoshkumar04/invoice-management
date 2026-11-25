import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UserProfile,
} from "../lib/profile-api";

import { useAuthStore } from "../stores/auth.store";

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
};

export function useMyProfile() {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateMyProfile(input),

    onSuccess: async (profile: UserProfile) => {
      queryClient.setQueryData(profileKeys.me(), profile);

      // Synchronize the authenticated user across the application.
      useAuthStore.getState().setUser(profile);

      await queryClient.invalidateQueries({
        queryKey: profileKeys.me(),
      });
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changeMyPassword(input),
  });
}
