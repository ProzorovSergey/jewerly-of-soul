-- =====================================================================
--  Jewerly of Soul — структура базы данных
-- ---------------------------------------------------------------------
--  Выполни этот файл ОДИН РАЗ после создания базы MySQL на reg.ru:
--    панель reg.ru → phpMyAdmin → выбрать свою базу →
--    вкладка «SQL» → вставить весь текст ниже → «Вперёд».
--
--  Администратор сайта назначается автоматически: пользователь,
--  зарегистрированный с почтой из api/config.php (поле admin_email),
--  получает доступ к админ-панели. Отдельно ничего вписывать не нужно.
-- =====================================================================

SET NAMES utf8mb4;

-- --- Пользователи ----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              CHAR(36)      NOT NULL,
    email           VARCHAR(190)  NOT NULL,
    username        VARCHAR(60)   NOT NULL,
    display_name    VARCHAR(120)  NOT NULL,
    avatar          VARCHAR(16)   NOT NULL DEFAULT '✦',
    password_hash   VARCHAR(255)  NOT NULL,
    role            VARCHAR(10)   NOT NULL DEFAULT 'user',
    created_at      DATETIME      NOT NULL,
    likes           LONGTEXT      NULL,
    favorites       LONGTEXT      NULL,
    published_ideas LONGTEXT      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_email (email),
    UNIQUE KEY uniq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Сессии (токены входа) ------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    token       CHAR(64)  NOT NULL,
    user_id     CHAR(36)  NOT NULL,
    created_at  DATETIME  NOT NULL,
    expires_at  DATETIME  NOT NULL,
    PRIMARY KEY (token),
    KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Заявки на браслеты ---------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              CHAR(36)     NOT NULL,
    public_code     VARCHAR(12)  NOT NULL,
    user_id         CHAR(36)     NULL,
    contact_name    VARCHAR(120) NOT NULL,
    contact_method  VARCHAR(20)  NOT NULL,
    contact_value   VARCHAR(190) NOT NULL,
    composition     LONGTEXT     NOT NULL,
    bracelet_length INT          NULL,
    comment         TEXT         NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'new',
    admin_note      TEXT         NULL,
    created_at      DATETIME     NOT NULL,
    updated_at      DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_code (public_code),
    KEY idx_user (user_id),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Токены восстановления пароля ------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    token       CHAR(64)  NOT NULL,
    user_id     CHAR(36)  NOT NULL,
    created_at  DATETIME  NOT NULL,
    expires_at  DATETIME  NOT NULL,
    PRIMARY KEY (token),
    KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Анти-спам: журнал обращений для ограничения частоты -------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    bucket      VARCHAR(120) NOT NULL,
    created_at  DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_bucket (bucket, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Идеи сообщества -------------------------------------------------
CREATE TABLE IF NOT EXISTS ideas (
    id                 CHAR(36)     NOT NULL,
    author_id          CHAR(36)     NOT NULL,
    title              VARCHAR(200) NOT NULL,
    description        TEXT         NULL,
    stones             LONGTEXT     NOT NULL,
    length             INT          NOT NULL DEFAULT 180,
    tags               LONGTEXT     NULL,
    mood               VARCHAR(40)  NULL,
    is_public          TINYINT      NOT NULL DEFAULT 1,
    energy_description TEXT         NULL,
    likes_count        INT          NOT NULL DEFAULT 0,
    created_at         DATETIME     NOT NULL,
    updated_at         DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_author (author_id),
    KEY idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
