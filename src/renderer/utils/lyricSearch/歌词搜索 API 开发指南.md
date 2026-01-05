# 歌词搜索 API 开发指南

本指南说明如何维护、修改和扩展歌词搜索功能。

---

## 目录结构

```
src/renderer/utils/lyricSearch/
├── types.ts      # TypeScript 类型定义
├── utils.js      # 公共工具函数
├── index.js      # 统一入口，聚合所有平台
├── tx.js         # QQ 音乐
├── kg.js         # 酷狗音乐
└── wy.js         # 网易云音乐
```

---

## 添加新平台

### 步骤 1：创建平台模块

在 `lyricSearch/` 目录下创建新文件，如 `mg.js`（咪咕音乐）：

```javascript
/**
 * 咪咕音乐歌词搜索 API
 */

// 如果已有现成的 musicSdk 模块，可以直接复用
import musicSearch from '../musicSdk/mg/musicSearch'
import lyric from '../musicSdk/mg/lyric'

const source = 'mg'    // 平台标识
const name = '咪咕音乐'  // 显示名称

/**
 * 搜索歌曲
 * @param {string} keyword 关键词
 * @param {number} page 页码
 * @returns {Promise<SearchResult>}
 */
const searchSongs = async (keyword, page = 1) => {
    const limit = 20
    const result = await musicSearch.search(keyword, page, limit)
    
    // 将结果转换为统一格式
    const list = result.list.map(item => ({
        source,
        id: item.songmid?.toString(),
        name: item.name,
        singer: item.singer,
        album: item.albumName,
        duration: parseInterval(item.interval),
        img: item.img,
        _extra: {
            // 保存获取歌词所需的额外信息
            songmid: item.songmid,
            hash: item.hash,
        },
    }))
    
    return {
        list,
        page,
        hasMore: page < result.allPage,
        total: result.total,
    }
}

/**
 * 获取歌词
 * @param {SongSearchInfo} songInfo 歌曲信息
 * @returns {Promise<LyricContent>}
 */
const getLyric = async (songInfo) => {
    // 根据平台 API 实际情况调用
    const result = await lyric.getLyric({
        songmid: songInfo._extra?.songmid || songInfo.id,
    }).promise
    
    return {
        lyric: result.lyric || '',
        tlyric: result.tlyric || '',
        rlyric: result.rlyric || '',
        lxlyric: result.lxlyric || '',
    }
}

// 辅助函数：解析时长
const parseInterval = (interval) => {
    if (!interval) return 0
    const parts = interval.split(':')
    if (parts.length !== 2) return 0
    return (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000
}

export default {
    source,
    name,
    searchSongs,
    getLyric,
}
```

### 步骤 2：注册到入口文件

修改 `lyricSearch/index.js`：

```javascript
import mgApi from './mg'

export const sources = {
    tx: txApi,
    kg: kgApi,
    wy: wyApi,
    mg: mgApi,  // 新增
}
```

### 步骤 3：添加平台名称

修改 `lyricSearch/utils.js`：

```javascript
export const sourceNames = {
    tx: 'QQ音乐',
    kg: '酷狗音乐',
    wy: '网易云',
    mg: '咪咕音乐',  // 新增
}
```

---

## 修改现有平台 API

### 修改搜索逻辑

编辑对应平台文件的 `searchSongs` 函数：
- [tx.js](file:///H:/repositories/music-alonewinds/src/renderer/utils/lyricSearch/tx.js) - QQ 音乐
- [kg.js](file:///H:/repositories/music-alonewinds/src/renderer/utils/lyricSearch/kg.js) - 酷狗音乐
- [wy.js](file:///H:/repositories/music-alonewinds/src/renderer/utils/lyricSearch/wy.js) - 网易云音乐

### 修改歌词获取逻辑

编辑对应平台文件的 `getLyric` 函数。

> [!NOTE]
> 各平台的底层 API 实现在 `src/renderer/utils/musicSdk/` 目录下。如需深度修改，需查看对应子目录（如 `musicSdk/tx/lyric.js`）。

---

## 类型定义

歌词搜索使用的核心类型定义在 [types.ts](file:///H:/repositories/music-alonewinds/src/renderer/utils/lyricSearch/types.ts)：

| 类型 | 说明 |
|------|------|
| `LyricSource` | 平台标识 `'tx' \| 'kg' \| 'wy'` |
| `SongSearchInfo` | 搜索结果中的歌曲信息 |
| `LyricContent` | 歌词内容（原文/翻译/罗马音/逐字） |
| `SearchResult` | 搜索结果列表 |

---

## 调试技巧

1. 打开浏览器开发者工具查看网络请求
2. 在 `getLyric` 或 `searchSongs` 中添加 `console.log` 调试
3. 检查 `_extra` 字段是否正确传递了获取歌词所需的信息

---

## 相关文件

| 文件 | 用途 |
|------|------|
| [LyricSearchModal.vue](file:///H:/repositories/music-alonewinds/src/renderer/components/layout/PlayDetail/components/LyricSearchModal.vue) | UI 组件 |
| [LyricPlayer.vue](file:///H:/repositories/music-alonewinds/src/renderer/components/layout/PlayDetail/LyricPlayer.vue) | 歌词搜索集成入口 |
| [zh-cn.json](file:///H:/repositories/music-alonewinds/src/lang/zh-cn.json) | 中文翻译 |
| [en-us.json](file:///H:/repositories/music-alonewinds/src/lang/en-us.json) | 英文翻译 |
