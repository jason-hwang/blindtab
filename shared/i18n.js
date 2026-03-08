'use strict';

window.BT_I18N = {
  en: {
    // ── Popup ──────────────────────────────────────────────────────────────
    currentPage:          'Current page',
    protectThisPage:      'Protect This Page',
    removeProtection:     'Remove Protection',
    alsoLockSubpaths:     'Also lock subpaths',
    authMessage:          'Enter your password to remove protection.',
    passwordPlaceholder:  'Password',
    confirm:              'Confirm',
    incorrectPassword:    'Incorrect password.',
    noPasswordSet:        'No password set.',
    noBannerText:         '⚠️ No password set.',
    setUpNow:             'Set up now →',
    manageUrls:           'Manage all protected URLs →',
    loading:              'Loading…',
    unableToRead:         'Unable to read page URL.',

    // ── Overlay ────────────────────────────────────────────────────────────
    pageProtected:        'This page is protected',
    enterToUnlock:        'Enter your password to unlock',
    unlock:               'Unlock',
    incorrectPasswordRetry: 'Incorrect password. Try again.',
    noPasswordSetConfig:  'No password set. Configure in extension options.',
    keepUnlocked5min:     'Keep unlocked for 5 minutes',
    lockPageNow:          'Lock page now',

    // ── Options ────────────────────────────────────────────────────────────
    settings:             'Settings',
    passwordSection:      'Password',
    protectedUrlsSection: 'Protected URLs',
    languageSection:      'Language',
    languageDesc:         'Choose the display language for BlindTab.',
    savePassword:         'Save Password',
    saved:                '✓ Saved!',
    currentPassword:      'Current password',
    newPassword:          'New password',
    confirmNewPassword:   'Confirm new password',
    currentPasswordPh:    'Leave blank if none set',
    newPasswordPh:        'Enter new password',
    repeatPasswordPh:     'Repeat new password',
    urlSectionDesc:       'Pages on this list will show a blur overlay until unlocked with your password.',
    urlPlaceholder:       'https://example.com/secret-page',
    addUrl:               'Add',
    removeUrl:            'Remove',
    currentTab:           'Current tab',
    noProtectedUrls:      'No protected URLs yet.',
    passwordIsSet:        'Password is set.',
    noPasswordSetWarning: 'No password set. All protected URLs are inaccessible until you set one.',

    // ── Options errors ─────────────────────────────────────────────────────
    errEnterCurrent:    'Enter your current password to make changes.',
    errCurrentIncorrect:'Current password is incorrect.',
    errNewEmpty:        'New password cannot be empty.',
    errTooShort:        'Password must be at least 4 characters.',
    errNoMatch:         'Passwords do not match.',
    errEnterUrl:        'Please enter a URL.',
    errInvalidUrl:      'Please enter a valid URL (starting with http:// or https://).',
    errUrlExists:       'This URL is already in the list.',
  },

  ko: {
    // ── Popup ──────────────────────────────────────────────────────────────
    currentPage:          '현재 페이지',
    protectThisPage:      '이 페이지 보호',
    removeProtection:     '보호 해제',
    alsoLockSubpaths:     '하위 경로도 함께 잠금',
    authMessage:          '보호를 해제하려면 비밀번호를 입력하세요.',
    passwordPlaceholder:  '비밀번호',
    confirm:              '확인',
    incorrectPassword:    '비밀번호가 올바르지 않습니다.',
    noPasswordSet:        '비밀번호가 설정되지 않았습니다.',
    noBannerText:         '⚠️ 비밀번호가 설정되지 않았습니다.',
    setUpNow:             '지금 설정하기 →',
    manageUrls:           '보호된 URL 전체 관리 →',
    loading:              '로딩 중…',
    unableToRead:         '페이지 URL을 읽을 수 없습니다.',

    // ── Overlay ────────────────────────────────────────────────────────────
    pageProtected:        '이 페이지는 보호되어 있습니다',
    enterToUnlock:        '잠금을 해제하려면 비밀번호를 입력하세요',
    unlock:               '잠금 해제',
    incorrectPasswordRetry: '비밀번호가 올바르지 않습니다. 다시 시도해 주세요.',
    noPasswordSetConfig:  '비밀번호가 설정되지 않았습니다. 확장 프로그램 설정에서 구성해 주세요.',
    keepUnlocked5min:     '5분간 잠금 해제 유지',
    lockPageNow:          '페이지 즉시 잠금',

    // ── Options ────────────────────────────────────────────────────────────
    settings:             '설정',
    passwordSection:      '비밀번호',
    protectedUrlsSection: '보호된 URL',
    languageSection:      '언어',
    languageDesc:         'BlindTab의 표시 언어를 선택하세요.',
    savePassword:         '비밀번호 저장',
    saved:                '✓ 저장됨!',
    currentPassword:      '현재 비밀번호',
    newPassword:          '새 비밀번호',
    confirmNewPassword:   '새 비밀번호 확인',
    currentPasswordPh:    '설정된 비밀번호가 없으면 비워두세요',
    newPasswordPh:        '새 비밀번호를 입력하세요',
    repeatPasswordPh:     '새 비밀번호를 다시 입력하세요',
    urlSectionDesc:       '이 목록의 페이지는 비밀번호로 잠금 해제할 때까지 블러 오버레이가 표시됩니다.',
    urlPlaceholder:       'https://example.com/비밀-페이지',
    addUrl:               '추가',
    removeUrl:            '삭제',
    currentTab:           '현재 탭',
    noProtectedUrls:      '보호된 URL이 없습니다.',
    passwordIsSet:        '비밀번호가 설정되어 있습니다.',
    noPasswordSetWarning: '비밀번호가 설정되지 않았습니다. 설정하기 전까지 보호된 모든 URL에 접근할 수 없습니다.',

    // ── Options errors ─────────────────────────────────────────────────────
    errEnterCurrent:    '변경하려면 현재 비밀번호를 입력하세요.',
    errCurrentIncorrect:'현재 비밀번호가 올바르지 않습니다.',
    errNewEmpty:        '새 비밀번호를 입력해 주세요.',
    errTooShort:        '비밀번호는 4자 이상이어야 합니다.',
    errNoMatch:         '비밀번호가 일치하지 않습니다.',
    errEnterUrl:        'URL을 입력해 주세요.',
    errInvalidUrl:      '유효한 URL을 입력해 주세요 (http:// 또는 https://로 시작해야 합니다).',
    errUrlExists:       '이 URL은 이미 목록에 있습니다.',
  },
};

// Global translate helper
window.BT_T = function (lang, key) {
  return (window.BT_I18N[lang] && window.BT_I18N[lang][key])
    || (window.BT_I18N.en && window.BT_I18N.en[key])
    || key;
};
