<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authStore } from '../stores';
  import adminApi, { type VocabularyItemCreate, type VocabularyItemUpdate } from '../adminApi';
  import type { VocabularyItem } from '../api-types';

  let token: string | null = null;
  let searchQuery = '';
  let searchResults: VocabularyItem[] = [];
  let selectedItem: VocabularyItem | null = null;
  let showEditModal = false;
  let showCreateModal = false;
  let loading = false;
  let searchDebounceTimer: NodeJS.Timeout | null = null;
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' = 'info';
  let showToast = false;

  let editForm = {
    sourceText: '',
    targetText: '',
    sourceUsageExample: '',
    targetUsageExample: '',
  };

  let createForm: VocabularyItemCreate = {
    sourceText: '',
    sourceLanguage: 'en',
    targetText: '',
    targetLanguage: 'ru',
    listName: 'english-russian-a1',
    difficultyLevel: 'A1',
    sourceUsageExample: '',
    targetUsageExample: '',
  };

  const unsubscribe = authStore.subscribe(({ token: authToken }) => {
    token = authToken;
  });

  onMount(() => {
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      unsubscribe();
      document.removeEventListener('keydown', handleGlobalKeydown);
    };
  });

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });

  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
    if (e.key === 'Escape') {
      if (showEditModal) closeEditModal();
      if (showCreateModal) closeCreateModal();
    }
  }

  function showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toastMessage = message;
    toastType = type;
    showToast = true;
    setTimeout(() => {
      showToast = false;
    }, 3000);
  }

  function debouncedSearch() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      handleSearch();
    }, 500);
  }

  async function handleSearch() {
    if (!token || !searchQuery.trim()) {
      searchResults = [];
      return;
    }

    loading = true;

    try {
      searchResults = await adminApi.searchVocabulary(token, searchQuery);
      if (searchResults.length === 0) {
        showToastMessage('No results found', 'info');
      }
    } catch (e) {
      showToastMessage(e instanceof Error ? e.message : 'Search failed', 'error');
    } finally {
      loading = false;
    }
  }

  function openEditModal(item: VocabularyItem) {
    selectedItem = item;
    showEditModal = true;
    editForm = {
      sourceText: item.sourceText,
      targetText: item.targetText,
      sourceUsageExample: item.sourceUsageExample || '',
      targetUsageExample: item.targetUsageExample || '',
    };
  }

  function closeEditModal() {
    showEditModal = false;
    selectedItem = null;
  }

  async function handleUpdateItem() {
    if (!token || !selectedItem) return;

    loading = true;

    try {
      const updates: VocabularyItemUpdate = {};
      if (editForm.sourceText !== selectedItem.sourceText) updates.sourceText = editForm.sourceText;
      if (editForm.targetText !== selectedItem.targetText) updates.targetText = editForm.targetText;
      if (editForm.sourceUsageExample !== (selectedItem.sourceUsageExample || '')) {updates.sourceUsageExample = editForm.sourceUsageExample;}
      if (editForm.targetUsageExample !== (selectedItem.targetUsageExample || '')) {updates.targetUsageExample = editForm.targetUsageExample;}

      if (Object.keys(updates).length === 0) {
        showToastMessage('No changes to save', 'info');
        loading = false;
        return;
      }

      await adminApi.updateVocabularyItem(token, selectedItem.id, updates);
      showToastMessage('✓ Vocabulary item updated successfully', 'success');
      closeEditModal();
      if (searchQuery) await handleSearch();
    } catch (e) {
      showToastMessage(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    showCreateModal = true;
    createForm = {
      sourceText: '',
      sourceLanguage: 'en',
      targetText: '',
      targetLanguage: 'ru',
      listName: 'english-russian-a1',
      difficultyLevel: 'A1',
      sourceUsageExample: '',
      targetUsageExample: '',
    };
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  async function handleCreateItem() {
    if (!token) return;

    loading = true;

    try {
      await adminApi.createVocabularyItem(token, createForm);
      showToastMessage('✓ Vocabulary item created successfully', 'success');
      closeCreateModal();
      if (searchQuery) await handleSearch();
    } catch (e) {
      showToastMessage(e instanceof Error ? e.message : 'Create failed', 'error');
    } finally {
      loading = false;
    }
  }

  async function handleDeleteItem(item: VocabularyItem) {
    if (
      !token ||
      !confirm(`Are you sure you want to delete "${item.sourceText} → ${item.targetText}"?`)
    ) {return;}

    loading = true;

    try {
      await adminApi.deleteVocabularyItem(token, item.id);
      showToastMessage('✓ Vocabulary item deleted', 'success');
      searchResults = searchResults.filter((i) => i.id !== item.id);
      if (selectedItem?.id === item.id) {
        closeEditModal();
      }
    } catch (e) {
      showToastMessage(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      loading = false;
    }
  }
</script>

<div class="admin-wrapper">
  <!-- Header -->
  <header class="admin-header">
    <div class="header-content">
      <div class="header-title">
        <h1>📚 Vocabulary Manager</h1>
        <p class="subtitle">Admin Panel</p>
      </div>
      <div class="header-stats">
        <div class="stat-card">
          <div class="stat-value">{searchResults.length}</div>
          <div class="stat-label">Results</div>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="admin-main">
    <!-- Search Section -->
    <div class="search-section">
      <div class="search-container">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            id="search-input"
            type="text"
            bind:value={searchQuery}
            on:input={debouncedSearch}
            on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search vocabulary... (Ctrl+K)"
            class="search-input"
          />
          {#if searchQuery}
            <button
              class="search-clear"
              on:click={() => {
                searchQuery = '';
                searchResults = [];
              }}
            >
              ✕
            </button>
          {/if}
        </div>
        <button on:click={openCreateModal} disabled={loading} class="btn btn-primary">
          + Create New
        </button>
      </div>
    </div>

    <!-- Loading State -->
    {#if loading && searchResults.length === 0}
      <div class="loading-skeleton">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    {/if}

    <!-- Empty State -->
    {#if !loading && searchResults.length === 0 && searchQuery}
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No results found</h3>
        <p>Try searching for different keywords or create a new vocabulary item.</p>
      </div>
    {/if}

    {#if !loading && searchResults.length === 0 && !searchQuery}
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <h3>Start searching</h3>
        <p>Use the search bar above to find vocabulary items, or create a new one.</p>
        <div class="keyboard-hint">
          Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to focus search
        </div>
      </div>
    {/if}

    <!-- Results Grid -->
    {#if searchResults.length > 0}
      <div class="results-grid">
        {#each searchResults as item (item.id)}
          <div class="vocab-card" class:inactive={!item.isActive}>
            <div class="vocab-header">
              <div class="vocab-languages">
                <span class="lang-badge">{item.sourceLanguage.toUpperCase()}</span>
                <span class="arrow">→</span>
                <span class="lang-badge">{item.targetLanguage.toUpperCase()}</span>
              </div>
              <div class="vocab-list-badge">{item.listName}</div>
            </div>

            <div class="vocab-content">
              <div class="vocab-pair">
                <div class="vocab-text source">{item.sourceText}</div>
                <div class="vocab-text target">{item.targetText}</div>
              </div>

              {#if item.sourceUsageExample || item.targetUsageExample}
                <div class="vocab-examples">
                  {#if item.sourceUsageExample}
                    <div class="example">
                      <span class="example-label">Example:</span>
                      <span class="example-text">{item.sourceUsageExample}</span>
                    </div>
                  {/if}
                  {#if item.targetUsageExample}
                    <div class="example">
                      <span class="example-label">Translation:</span>
                      <span class="example-text">{item.targetUsageExample}</span>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <div class="vocab-actions">
              <button on:click={() => openEditModal(item)} class="btn btn-sm btn-edit">
                ✏️ Edit
              </button>
              <button on:click={() => handleDeleteItem(item)} class="btn btn-sm btn-delete">
                🗑️ Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </main>

  <!-- Edit Modal -->
  {#if showEditModal && selectedItem}
    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      on:click={closeEditModal}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') closeEditModal();
      }}
    ></div>
    <div class="modal">
      <div class="modal-header">
        <h2>✏️ Edit Vocabulary Item</h2>
        <button class="modal-close" on:click={closeEditModal}>✕</button>
      </div>

      <form on:submit|preventDefault={handleUpdateItem} class="modal-content">
        <div class="form-grid">
          <div class="form-group">
            <label for="edit-source">Source Text</label>
            <input
              id="edit-source"
              type="text"
              bind:value={editForm.sourceText}
              required />
          </div>

          <div class="form-group">
            <label for="edit-target">Target Text</label>
            <input
              id="edit-target"
              type="text"
              bind:value={editForm.targetText}
              required />
          </div>
        </div>

        <div class="form-group">
          <label for="edit-source-example">Source Example (optional)</label>
          <textarea
            id="edit-source-example"
            bind:value={editForm.sourceUsageExample}
            rows="2"
            placeholder="Example sentence in source language"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="edit-target-example">Target Example (optional)</label>
          <textarea
            id="edit-target-example"
            bind:value={editForm.targetUsageExample}
            rows="2"
            placeholder="Example sentence in target language"
          ></textarea>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            on:click={closeEditModal}
            disabled={loading}
            class="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} class="btn btn-primary">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Create Modal -->
  {#if showCreateModal}
    <div
      class="modal-backdrop"
      role="button"
      tabindex="0"
      on:click={closeCreateModal}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') closeCreateModal();
      }}
    ></div>
    <div class="modal">
      <div class="modal-header">
        <h2>➕ Create New Vocabulary Item</h2>
        <button class="modal-close" on:click={closeCreateModal}>✕</button>
      </div>

      <form on:submit|preventDefault={handleCreateItem} class="modal-content">
        <div class="form-grid">
          <div class="form-group">
            <label for="create-source">Source Text</label>
            <input
              id="create-source"
              type="text"
              bind:value={createForm.sourceText}
              required />
          </div>

          <div class="form-group">
            <label for="create-target">Target Text</label>
            <input
              id="create-target"
              type="text"
              bind:value={createForm.targetText}
              required />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="create-source-lang">Source Language</label>
            <select id="create-source-lang" bind:value={createForm.sourceLanguage}>
              <option value="en">English</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="ru">Russian</option>
            </select>
          </div>

          <div class="form-group">
            <label for="create-target-lang">Target Language</label>
            <select id="create-target-lang" bind:value={createForm.targetLanguage}>
              <option value="en">English</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
              <option value="ru">Russian</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="create-list">List Name</label>
            <input
              id="create-list"
              type="text"
              bind:value={createForm.listName}
              required />
          </div>

          <div class="form-group">
            <label for="create-level">Difficulty Level</label>
            <select id="create-level" bind:value={createForm.difficultyLevel}>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="create-source-example">Source Example (optional)</label>
          <textarea
            id="create-source-example"
            bind:value={createForm.sourceUsageExample}
            rows="2"
            placeholder="Example sentence in source language"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="create-target-example">Target Example (optional)</label>
          <textarea
            id="create-target-example"
            bind:value={createForm.targetUsageExample}
            rows="2"
            placeholder="Example sentence in target language"
          ></textarea>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            on:click={closeCreateModal}
            disabled={loading}
            class="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} class="btn btn-primary">
            {loading ? 'Creating...' : 'Create Item'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Toast Notification -->
  {#if showToast}
    <div class="toast toast-{toastType}">
      {toastMessage}
    </div>
  {/if}
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .admin-wrapper {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
  }

  .admin-header {
    background: white;
    border-radius: 16px;
    padding: 24px 32px;
    margin-bottom: 24px;
    box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }

  .header-title h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #1a202c;
  }

  .subtitle {
    margin: 4px 0 0;
    color: #718096;
    font-size: 14px;
  }

  .header-stats {
    display: flex;
    gap: 16px;
  }

  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    text-align: center;
    min-width: 100px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
  }

  .stat-label {
    font-size: 12px;
    opacity: 0.9;
    margin-top: 2px;
  }

  .admin-main {
    background: white;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
    min-height: 500px;
  }

  .search-section {
    margin-bottom: 32px;
  }

  .search-container {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 20px;
    opacity: 0.5;
  }

  .search-input {
    width: 100%;
    padding: 14px 48px;
    font-size: 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgb(102 126 234 / 10%);
  }

  .search-clear {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: #e2e8f0;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
  }

  .search-clear:hover {
    background: #cbd5e0;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgb(102 126 234 / 40%);
  }

  .btn-secondary {
    background: #e2e8f0;
    color: #4a5568;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #cbd5e0;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }

  .btn-edit {
    background: #fbbf24;
    color: #78350f;
  }

  .btn-edit:hover:not(:disabled) {
    background: #f59e0b;
  }

  .btn-delete {
    background: #ef4444;
    color: white;
  }

  .btn-delete:hover:not(:disabled) {
    background: #dc2626;
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #718096;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    color: #2d3748;
    font-size: 20px;
  }

  .empty-state p {
    margin: 0 0 16px;
    font-size: 15px;
  }

  .keyboard-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    font-size: 14px;
    color: #4a5568;
  }

  kbd {
    background: #e2e8f0;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 2px 0 #cbd5e0;
  }

  .loading-skeleton {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .skeleton-card {
    height: 200px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s infinite;
    border-radius: 12px;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }

    100% {
      background-position: -200% 0;
    }
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .vocab-card {
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    transition: all 0.2s;
  }

  .vocab-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgb(102 126 234 / 15%);
    transform: translateY(-2px);
  }

  .vocab-card.inactive {
    opacity: 0.5;
    background: #f7fafc;
  }

  .vocab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .vocab-languages {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lang-badge {
    background: #667eea;
    color: white;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .arrow {
    color: #cbd5e0;
    font-weight: bold;
  }

  .vocab-list-badge {
    background: #e2e8f0;
    color: #4a5568;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .vocab-content {
    margin-bottom: 16px;
  }

  .vocab-pair {
    margin-bottom: 12px;
  }

  .vocab-text {
    padding: 8px 0;
    font-size: 16px;
  }

  .vocab-text.source {
    font-weight: 600;
    color: #2d3748;
  }

  .vocab-text.target {
    color: #4a5568;
  }

  .vocab-examples {
    background: #f7fafc;
    padding: 12px;
    border-radius: 8px;
    margin-top: 12px;
  }

  .example {
    margin-bottom: 8px;
    font-size: 13px;
  }

  .example:last-child {
    margin-bottom: 0;
  }

  .example-label {
    color: #718096;
    font-weight: 600;
    margin-right: 6px;
  }

  .example-text {
    color: #4a5568;
    font-style: italic;
  }

  .vocab-actions {
    display: flex;
    gap: 8px;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 60%);
    backdrop-filter: blur(4px);
    z-index: 999;
    animation: fade-in 0.2s;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 16px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 20px 60px rgb(0 0 0 / 30%);
    animation: slide-up 0.3s;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translate(-50%, -45%);
    }

    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 28px;
    border-bottom: 2px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 22px;
    color: #1a202c;
  }

  .modal-close {
    background: #e2e8f0;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: #cbd5e0;
    transform: rotate(90deg);
  }

  .modal-content {
    padding: 24px 28px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px 28px;
    border-top: 2px solid #e2e8f0;
    background: #f7fafc;
    border-radius: 0 0 16px 16px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #2d3748;
    font-size: 14px;
  }

  input[type='text'],
  select,
  textarea {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 15px;
    transition: all 0.2s;
    font-family: inherit;
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }

  input[type='text']:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgb(102 126 234 / 10%);
  }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 15%);
    z-index: 2000;
    animation: slide-in 0.3s, slide-out 0.3s 2.7s;
    font-weight: 500;
    border-left: 4px solid;
  }

  .toast-success {
    border-left-color: #10b981;
    color: #065f46;
  }

  .toast-error {
    border-left-color: #ef4444;
    color: #991b1b;
  }

  .toast-info {
    border-left-color: #3b82f6;
    color: #1e40af;
  }

  @keyframes slide-in {
    from {
      transform: translateX(400px);
      opacity: 0;
    }

    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }

    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @media (width <= 768px) {
    .admin-wrapper {
      padding: 12px;
    }

    .admin-header {
      padding: 20px;
    }

    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .admin-main {
      padding: 20px;
    }

    .search-container {
      flex-direction: column;
    }

    .search-input-wrapper {
      width: 100%;
    }

    .results-grid {
      grid-template-columns: 1fr;
    }

    .modal {
      width: 95%;
    }

    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
