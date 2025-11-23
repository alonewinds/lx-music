import { ref, type Ref, useCssModule } from '@common/utils/vueTools'
import { updateUserListPosition } from '@renderer/store/list/action'
import { userLists } from '@renderer/store/list/state'
import useDarg from '@renderer/utils/compositions/useDrag'


export default ({ dom_lists_list, handleSaveListName, handleMenuClick }: {
  dom_lists_list: Ref<HTMLElement | null>
  handleSaveListName: () => Promise<void> | void
  handleMenuClick: () => void
}) => {
  const isDragging = ref(false)
  const styles = useCssModule()

  useDarg({
    dom_list: dom_lists_list,
    dragingItemClassName: styles.dragingItem,
    filter: 'default-list',
    onUpdate(newIndex: number, oldIndex: number) {
      void updateUserListPosition({ ids: [userLists[oldIndex - 2].id], position: newIndex - 2 })
    },
    onStart() {
      isDragging.value = true
      void handleSaveListName()
      handleMenuClick()
    },
    onEnd() {
      isDragging.value = false
    },
  })

  return {
    isDragging,
  }
}
