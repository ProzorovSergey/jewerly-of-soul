/**
 * userService.js
 * ----------------------------------------------------------------
 * Получение публичных профилей. Тонкая обёртка над userApi.
 */

import { userApi } from '../api/index.js';

export async function getById(id)         { return userApi.getById(id); }
export async function getByUsername(name) { return userApi.getByUsername(name); }
export async function listAll()           { return userApi.listAll(); }
