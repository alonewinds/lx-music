import { onBeforeUnmount } from '@common/utils/vueTools'
import { playMusic } from '@renderer/core/player/action'
import { addTempPlayList } from '@renderer/store/player/action'
import { LIST_IDS } from '@common/constants'

const SUPPORTED_EXTENSIONS = new Set(['mp3', 'flac', 'ogg', 'oga', 'wav', 'm4a'])

// 获取拖入文件的本地路径（兼容新旧版 Electron）
const getFilePath = (() => {
    try {
        // Electron 29+ 使用 webUtils.getPathForFile
        const { webUtils } = require('electron')
        if (webUtils?.getPathForFile) return (file: File) => webUtils.getPathForFile(file) as string
    } catch { }
    // 旧版 Electron 使用 File.path
    return (file: File) => (file as any).path as string | undefined
})()

const getFileExtension = (name: string): string => {
    const idx = name.lastIndexOf('.')
    return idx > 0 ? name.slice(idx + 1).toLowerCase() : ''
}

const filterAudioFiles = (files: FileList): string[] => {
    const paths: string[] = []
    for (const file of files) {
        if (SUPPORTED_EXTENSIONS.has(getFileExtension(file.name))) {
            const p = getFilePath(file)
            if (p) paths.push(p)
        }
    }
    return paths
}

// 创建拖拽遮罩 DOM
const createOverlay = (): HTMLDivElement => {
    const overlay = document.createElement('div')
    overlay.id = 'drag-drop-overlay'
    overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
    transition: opacity 0.2s ease;
    opacity: 0;
    pointer-events: none;
  `

    const content = document.createElement('div')
    content.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #fff;
    pointer-events: none;
  `

    // 图标
    const icon = document.createElement('div')
    icon.style.cssText = `
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    animation: dragPulse 1.5s ease-in-out infinite;
  `
    icon.textContent = '🎵'

    // 文字
    const text = document.createElement('div')
    text.style.cssText = `
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 1px;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  `
    text.textContent = window.i18n.t('drag_drop__tip')

    content.appendChild(icon)
    content.appendChild(text)
    overlay.appendChild(content)

    // 添加动画关键帧
    if (!document.getElementById('drag-drop-keyframes')) {
        const style = document.createElement('style')
        style.id = 'drag-drop-keyframes'
        style.textContent = `
      @keyframes dragPulse {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.1); opacity: 1; }
      }
    `
        document.head.appendChild(style)
    }

    document.body.appendChild(overlay)
    return overlay
}

let showOverlay: (show: boolean) => void

export default () => {
    const overlay = createOverlay()
    let dragEnterCount = 0

    showOverlay = (show: boolean) => {
        if (show) {
            overlay.style.display = 'flex'
            // 触发 reflow 让 transition 生效
            void overlay.offsetHeight
            overlay.style.opacity = '1'
        } else {
            overlay.style.opacity = '0'
            setTimeout(() => {
                if (overlay.style.opacity === '0') {
                    overlay.style.display = 'none'
                }
            }, 200)
        }
    }

    const handleDragEnter = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragEnterCount++
        if (dragEnterCount === 1 && e.dataTransfer?.types.includes('Files')) {
            showOverlay(true)
        }
    }

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragEnterCount--
        if (dragEnterCount <= 0) {
            dragEnterCount = 0
            showOverlay(false)
        }
    }

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragEnterCount = 0
        showOverlay(false)

        if (!e.dataTransfer?.files.length) return
        const filePaths = filterAudioFiles(e.dataTransfer.files)
        console.log('[DragDrop] filePaths:', filePaths)
        if (!filePaths.length) return

        try {
            // 将文件路径转为 MusicInfoLocal
            const musicInfos = await window.lx.worker.main.createLocalMusicInfos(filePaths)
            console.log('[DragDrop] musicInfos:', musicInfos)
            if (!musicInfos.length) return

            // 第一首立即临时播放
            const first = musicInfos[0]
            playMusic(first, null, true)

            // 其余加入稍后播放队列顶部
            if (musicInfos.length > 1) {
                addTempPlayList(
                    musicInfos.slice(1).map(info => ({
                        listId: LIST_IDS.PLAY_LATER,
                        musicInfo: info,
                        isTop: true,
                    })),
                )
            }
        } catch (err) {
            console.error('[DragDrop] error:', err)
        }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)

    onBeforeUnmount(() => {
        document.removeEventListener('dragenter', handleDragEnter)
        document.removeEventListener('dragover', handleDragOver)
        document.removeEventListener('dragleave', handleDragLeave)
        document.removeEventListener('drop', handleDrop)
        overlay.remove()
    })
}
