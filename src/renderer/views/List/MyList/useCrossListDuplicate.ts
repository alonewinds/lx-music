import { ref } from '@common/utils/vueTools'


export default () => {
    const isShowCrossListDuplicateModal = ref(false)

    const handleCrossListDuplicate = () => {
        isShowCrossListDuplicateModal.value = true
    }

    return {
        isShowCrossListDuplicateModal,
        handleCrossListDuplicate,
    }
}
