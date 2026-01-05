/**
 * 歌词搜索 API 类型定义
 */

/** 歌词来源平台 */
export type LyricSource = 'tx' | 'kg' | 'wy'

/** 搜索结果中的歌曲信息 */
export interface SongSearchInfo {
  /** 歌曲来源平台 */
  source: LyricSource
  /** 歌曲ID */
  id: string
  /** 歌曲名 */
  name: string
  /** 副标题 */
  subtitle?: string
  /** 歌手名 */
  singer: string
  /** 专辑名 */
  album: string
  /** 时长（毫秒） */
  duration: number
  /** 专辑图片 */
  img?: string
  /** 平台特有的额外信息 */
  _extra?: Record<string, any>
}

/** 歌词内容 */
export interface LyricContent {
  /** 原文歌词 (LRC格式) */
  lyric: string
  /** 翻译歌词 */
  tlyric?: string
  /** 罗马音歌词 */
  rlyric?: string
  /** 逐字歌词 (LX格式) */
  lxlyric?: string
}

/** 搜索结果列表 */
export interface SearchResult {
  /** 歌曲列表 */
  list: SongSearchInfo[]
  /** 当前页码 */
  page: number
  /** 是否还有更多 */
  hasMore: boolean
  /** 总数量 */
  total?: number
}

/** 歌词搜索 API 接口 */
export interface LyricSearchAPI {
  /** 来源标识 */
  source: LyricSource
  /** 来源名称 */
  name: string
  /** 搜索歌曲 */
  searchSongs: (keyword: string, page?: number) => Promise<SearchResult>
  /** 获取歌词 */
  getLyric: (songInfo: SongSearchInfo) => Promise<LyricContent>
}
