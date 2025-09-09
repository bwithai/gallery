import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

import type { ItemPublic } from "@/client"
import DeleteItem from "../Items/DeleteItem"
import EditItem from "../Items/EditItem"

interface ItemActionsMenuProps {
  item: ItemPublic
  inModal?: boolean
}

export const ItemActionsMenu = ({ item, inModal = false }: ItemActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton 
          variant="ghost" 
          size="sm"
          color="gray.600"
          bg="white"
          _hover={{ 
            bg: "gray.100",
            color: "gray.800"
          }}
          borderRadius="full"
          shadow="sm"
        >
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent 
        portalled={!inModal} 
        zIndex={inModal ? "dropdown" : "auto"}
      >
        <EditItem item={item} />
        <DeleteItem id={item.id} />
      </MenuContent>
    </MenuRoot>
  )
}
