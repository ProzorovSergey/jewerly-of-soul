/**
 * interfaces.js
 * ----------------------------------------------------------------
 * JSDoc-описания контрактов API. В JS нет настоящих interface,
 * поэтому здесь — типы данных и сигнатуры методов, к которым
 * должны соответствовать реализации в js/api/local/* и в любых
 * будущих реализациях (Supabase, Firebase, custom backend).
 *
 * @file
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} username           уникальный логин
 * @property {string} displayName        отображаемое имя
 * @property {string} avatar             2-3 буквы инициалов или эмодзи
 * @property {string} passwordHash       SHA-256(salt:password)
 * @property {string} salt               уникальная соль
 * @property {string} createdAt          ISO-8601
 * @property {string[]} likes            id идей, которые юзер лайкнул
 * @property {string[]} favorites        id идей в избранном
 * @property {string[]} publishedIdeas   id опубликованных идей
 * @property {Object} [meta]             произвольные доп. поля (фейк/реал)
 */

/**
 * @typedef {Object} PublicUser
 *   То же, но без passwordHash, salt и приватных коллекций (likes/favorites).
 * @property {string} id
 * @property {string} username
 * @property {string} displayName
 * @property {string} avatar
 * @property {string} createdAt
 * @property {number} publishedCount
 */

/**
 * @typedef {Object} Session
 * @property {string} token         случайный токен сессии
 * @property {string} userId        к какому пользователю относится
 * @property {string} expiresAt     ISO-8601
 */

/**
 * @typedef {Object} BraceletStoneRef
 *   Камень в составе идеи браслета — пара id + размер.
 * @property {string} id            stones.json/<id>
 * @property {number} size          диаметр в мм (6/8/10)
 */

/**
 * @typedef {Object} Idea
 * @property {string} id
 * @property {string} authorId            User.id
 * @property {string} title
 * @property {string} description
 * @property {BraceletStoneRef[]} stones
 * @property {number} length              суммарная длина в мм
 * @property {string[]} tags              произвольные строки
 * @property {string} mood                одно из канонических настроений
 * @property {boolean} isPublic
 * @property {string} createdAt           ISO-8601
 * @property {string} updatedAt           ISO-8601
 * @property {number} likesCount          счётчик
 * @property {string} [energyDescription] AI-сгенерированный текст
 */

/**
 * @typedef {Object} AIDescribeRequest
 * @property {BraceletStoneRef[]} stones  с обогащёнными полями (передаются полные объекты)
 * @property {number} length
 * @property {string} [intent]            опциональное намерение/тема
 */

/**
 * @typedef {Object} AIDescribeResponse
 * @property {string} energyDescription   развёрнутый абзац про энергетику
 * @property {string} recommendations     когда / как носить
 * @property {string[]} nameSuggestions   3-5 коротких поэтичных названий
 * @property {Object} dominants
 * @property {string[]} dominants.elements 1-2 ведущих стихии
 * @property {string[]} dominants.energies 2-4 ведущих энергии
 */

/* ===========================================================
 * API-интерфейсы: контракты, которые должны соблюдать реализации
 * =========================================================== */

/**
 * @typedef {Object} AuthAPI
 * @property {(creds: {username: string, password: string, displayName: string}) => Promise<User>} register
 * @property {(creds: {username: string, password: string}) => Promise<{user: User, session: Session}>} login
 * @property {() => Promise<void>} logout
 * @property {() => Promise<User|null>} getCurrentUser
 * @property {(patch: Partial<User>) => Promise<User>} updateProfile
 */

/**
 * @typedef {Object} UserAPI
 * @property {(id: string) => Promise<PublicUser|null>} getById
 * @property {(username: string) => Promise<PublicUser|null>} getByUsername
 * @property {() => Promise<PublicUser[]>} listAll
 */

/**
 * @typedef {Object} IdeaAPI
 * @property {(idea: Partial<Idea>) => Promise<Idea>} create
 * @property {(id: string) => Promise<Idea|null>} getById
 * @property {(id: string, patch: Partial<Idea>) => Promise<Idea>} update
 * @property {(id: string) => Promise<void>} delete
 * @property {(filter?: {authorId?: string, isPublic?: boolean, tag?: string, mood?: string, stoneId?: string, search?: string, sort?: 'popular'|'recent'}) => Promise<Idea[]>} list
 * @property {(ideaId: string, userId: string) => Promise<{liked: boolean, likesCount: number}>} toggleLike
 * @property {(ideaId: string, userId: string) => Promise<{favorited: boolean}>} toggleFavorite
 */

/**
 * @typedef {Object} AIAPI
 * @property {(req: AIDescribeRequest) => Promise<AIDescribeResponse>} describe
 */

// Пустой экспорт, чтобы этот файл существовал как ES-модуль.
// IDE будет подхватывать @typedef-ы для интеллисенса.
export {};
