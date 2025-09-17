import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CollectionsService, ItemsService, type ItemUpdate } from "@/client"
import useCustomToast from "./useCustomToast"
import { handleError } from "@/utils"

export const useFavorites = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()

  // Get the Favorites collection
  const { data: collectionsData } = useQuery({
    queryKey: ["collections"],
    queryFn: () => CollectionsService.readCollections({}),
  })

  const favoritesCollection = collectionsData?.data?.find(
    (collection) => collection.name.toLowerCase() === "favorites"
  )

  // Mutation to save/unsave items to favorites
  const saveItemMutation = useMutation({
    mutationFn: async ({ itemId, isSaved }: { itemId: number; isSaved: boolean }) => {
      if (!favoritesCollection) {
        throw new Error("Favorites collection not found")
      }

      if (isSaved) {
        // If already saved, we need to move it back to its original collection
        // For now, we'll just show a message that it's already saved
        throw new Error("Item is already in favorites")
      } else {
        // Move item to favorites collection
        const updateData: ItemUpdate = {
          collection_id: favoritesCollection.id,
        }
        return ItemsService.updateItemMetadata({
          id: itemId,
          requestBody: updateData,
        })
      }
    },
    onSuccess: (_, variables) => {
      if (!variables.isSaved) {
        showSuccessToast("Item saved to favorites!")
      }
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["items"] })
      queryClient.invalidateQueries({ queryKey: ["collections"] })
    },
    onError: (err: any) => {
      if (err.message === "Item is already in favorites") {
        showSuccessToast("Item is already in your favorites!")
      } else {
        handleError(err)
      }
    },
  })

  // Check if an item is in favorites
  const isItemInFavorites = (itemCollectionId: number) => {
    return favoritesCollection?.id === itemCollectionId
  }

  return {
    favoritesCollection,
    saveItemMutation,
    isItemInFavorites,
    isLoading: saveItemMutation.isPending,
  }
}
