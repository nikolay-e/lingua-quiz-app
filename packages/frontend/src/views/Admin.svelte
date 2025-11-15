<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores';
  import adminApi, { type VocabularyItemCreate, type VocabularyItemUpdate } from '../adminApi';
  import type { VocabularyItem } from '../api-types';

  let token: string | null = null;
  let searchQuery = '';
  let searchResults: VocabularyItem[] = [];
  let selectedItem: VocabularyItem | null = null;
  let isEditing = false;
  let isCreating = false;
  let loading = false;
  let error: string | null = null;

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
    return () => {
      unsubscribe();
    };
  });

  async function handleSearch() {
    if (!token || !searchQuery.trim()) return;

    loading = true;
    error = null;

    try {
      searchResults = await adminApi.searchVocabulary(token, searchQuery);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Search failed';
    } finally {
      loading = false;
    }
  }

  function handleSelectItem(item: VocabularyItem) {
    selectedItem = item;
    isEditing = true;
    isCreating = false;
    editForm = {
      sourceText: item.sourceText,
      targetText: item.targetText,
      sourceUsageExample: item.sourceUsageExample || '',
      targetUsageExample: item.targetUsageExample || '',
    };
  }

  async function handleUpdateItem() {
    if (!token || !selectedItem) return;

    loading = true;
    error = null;

    try {
      const updates: VocabularyItemUpdate = {};
      if (editForm.sourceText !== selectedItem.sourceText) updates.sourceText = editForm.sourceText;
      if (editForm.targetText !== selectedItem.targetText) updates.targetText = editForm.targetText;
      if (editForm.sourceUsageExample !== (selectedItem.sourceUsageExample || '')) updates.sourceUsageExample = editForm.sourceUsageExample;
      if (editForm.targetUsageExample !== (selectedItem.targetUsageExample || '')) updates.targetUsageExample = editForm.targetUsageExample;

      if (Object.keys(updates).length === 0) {
        error = 'No changes to save';
        loading = false;
        return;
      }

      await adminApi.updateVocabularyItem(token, selectedItem.id, updates);
      alert('Vocabulary item updated successfully');
      handleCancelEdit();
      if (searchQuery) await handleSearch();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Update failed';
    } finally {
      loading = false;
    }
  }

  async function handleCreateItem() {
    if (!token) return;

    loading = true;
    error = null;

    try {
      await adminApi.createVocabularyItem(token, createForm);
      alert('Vocabulary item created successfully');
      handleCancelCreate();
      if (searchQuery) await handleSearch();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Create failed';
    } finally {
      loading = false;
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!token || !confirm('Are you sure you want to delete this item?')) return;

    loading = true;
    error = null;

    try {
      await adminApi.deleteVocabularyItem(token, itemId);
      alert('Vocabulary item deleted successfully');
      searchResults = searchResults.filter((item) => item.id !== itemId);
      if (selectedItem?.id === itemId) {
        handleCancelEdit();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Delete failed';
    } finally {
      loading = false;
    }
  }

  function handleCancelEdit() {
    isEditing = false;
    selectedItem = null;
  }

  function handleShowCreateForm() {
    isCreating = true;
    isEditing = false;
    selectedItem = null;
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

  function handleCancelCreate() {
    isCreating = false;
  }
</script>

<div class="admin-container">
  <header class="admin-header">
    <h1>Admin Panel - Vocabulary Management</h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <div class="search-section">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search vocabulary..."
      on:keydown={(e) => e.key === 'Enter' && handleSearch()} />
    <button on:click={handleSearch} disabled={loading || !searchQuery.trim()}>Search</button>
    <button on:click={handleShowCreateForm} disabled={loading} class="btn-create">Create New</button>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {/if}

  {#if searchResults.length > 0}
    <div class="results-section">
      <h2>Search Results ({searchResults.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>List</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each searchResults as item (item.id)}
            <tr class:inactive={!item.isActive}>
              <td>{item.sourceText}</td>
              <td>{item.targetText}</td>
              <td>{item.listName}</td>
              <td>
                <button on:click={() => handleSelectItem(item)} class="btn-edit">Edit</button>
                <button on:click={() => handleDeleteItem(item.id)} class="btn-delete">Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if isEditing && selectedItem}
    <div class="edit-section">
      <h2>Edit Vocabulary Item</h2>
      <form on:submit|preventDefault={handleUpdateItem}>
        <div class="form-group">
          <label for="sourceText">Source Text:</label>
          <input
            id="sourceText"
            type="text"
            bind:value={editForm.sourceText}
            required />
        </div>
        <div class="form-group">
          <label for="targetText">Target Text:</label>
          <input
            id="targetText"
            type="text"
            bind:value={editForm.targetText}
            required />
        </div>
        <div class="form-group">
          <label for="sourceExample">Source Example:</label>
          <textarea id="sourceExample" bind:value={editForm.sourceUsageExample} rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="targetExample">Target Example:</label>
          <textarea id="targetExample" bind:value={editForm.targetUsageExample} rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" disabled={loading}>Save Changes</button>
          <button type="button" on:click={handleCancelEdit} disabled={loading}>Cancel</button>
        </div>
      </form>
    </div>
  {/if}

  {#if isCreating}
    <div class="create-section">
      <h2>Create New Vocabulary Item</h2>
      <form on:submit|preventDefault={handleCreateItem}>
        <div class="form-group">
          <label for="createSourceText">Source Text:</label>
          <input
            id="createSourceText"
            type="text"
            bind:value={createForm.sourceText}
            required />
        </div>
        <div class="form-group">
          <label for="createTargetText">Target Text:</label>
          <input
            id="createTargetText"
            type="text"
            bind:value={createForm.targetText}
            required />
        </div>
        <div class="form-group">
          <label for="createListName">List Name:</label>
          <input
            id="createListName"
            type="text"
            bind:value={createForm.listName}
            required />
        </div>
        <div class="form-group">
          <label for="createSourceLang">Source Language:</label>
          <select id="createSourceLang" bind:value={createForm.sourceLanguage}>
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="ru">Russian</option>
          </select>
        </div>
        <div class="form-group">
          <label for="createTargetLang">Target Language:</label>
          <select id="createTargetLang" bind:value={createForm.targetLanguage}>
            <option value="en">English</option>
            <option value="de">German</option>
            <option value="es">Spanish</option>
            <option value="ru">Russian</option>
          </select>
        </div>
        <div class="form-group">
          <label for="createSourceExample">Source Example:</label>
          <textarea id="createSourceExample" bind:value={createForm.sourceUsageExample} rows="3"></textarea>
        </div>
        <div class="form-group">
          <label for="createTargetExample">Target Example:</label>
          <textarea id="createTargetExample" bind:value={createForm.targetUsageExample} rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" disabled={loading}>Create</button>
          <button type="button" on:click={handleCancelCreate} disabled={loading}>Cancel</button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  .admin-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .admin-header {
    margin-bottom: 30px;
  }

  .error-message {
    background-color: #f8d7da;
    color: #721c24;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .search-section {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
  }

  .search-section input {
    flex: 1;
    padding: 10px;
    font-size: 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .btn-create {
    background-color: #28a745;
  }

  .btn-create:hover:not(:disabled) {
    background-color: #218838;
  }

  .btn-edit {
    background-color: #ffc107;
    color: #000;
    padding: 5px 10px;
    font-size: 14px;
  }

  .btn-delete {
    background-color: #dc3545;
    padding: 5px 10px;
    font-size: 14px;
  }

  .loading {
    text-align: center;
    padding: 20px;
    font-size: 18px;
  }

  .results-section {
    margin-bottom: 30px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }

  th,
  td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }

  th {
    background-color: #f8f9fa;
    font-weight: 600;
  }

  tr.inactive {
    opacity: 0.5;
    text-decoration: line-through;
  }

  .edit-section,
  .create-section {
    background-color: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
  }

  .form-group {
    margin-bottom: 15px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
  }

  input[type='text'],
  select,
  textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
</style>
