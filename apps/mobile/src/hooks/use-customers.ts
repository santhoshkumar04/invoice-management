import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
  updateCustomerStatus,
  type CreateCustomerInput,
  type Customer,
  type CustomerListParams,
  type UpdateCustomerInput,
} from "../lib/customers-api";

export const customerKeys = {
  all: ["customers"] as const,

  lists: () => [...customerKeys.all, "list"] as const,

  list: (params?: CustomerListParams) =>
    [...customerKeys.lists(), params ?? {}] as const,

  details: () => [...customerKeys.all, "detail"] as const,

  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export function useCustomers(params?: CustomerListParams) {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: () => getCustomers(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => getCustomer(id),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCustomerInput) => createCustomer(input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.lists(),
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCustomerInput }) =>
      updateCustomer(id, input),

    onSuccess: async (customer: Customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: customerKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customer.id),
        }),
      ]);
    },
  });
}

export function useUpdateCustomerStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCustomerStatus(id, isActive),

    onSuccess: async (customer: Customer) => {
      queryClient.setQueryData(customerKeys.detail(customer.id), customer);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: customerKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customer.id),
        }),
      ]);
    },
  });
}
