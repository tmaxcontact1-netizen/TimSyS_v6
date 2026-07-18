'use strict';

const store = require('./store');

/**
 * Metadata catalog service.
 */
class MetadataService {
  async suggest(entityType, entityId, data) {
    // Placeholder: implement pattern detection/classification logic
    const tags = [];
    const classifications = [];

    // Example: derive tags from data properties
    if (data.email) tags.push('contact_available');
    if (data.phone) tags.push('phone_available');
    if (data.address) tags.push('address_on_file');

    // Example: classification based on entity type
    if (entityType === 'student') classifications.push('learner');
    if (entityType === 'teacher') classifications.push('educator');

    return {
      tags,
      classifications,
      confidence: 0.85,
    };
  }

  async get(entityType, entityId) {
    return store.getMetadata(entityType, entityId);
  }

  async store(entityType, entityId, data) {
    const suggestion = await this.suggest(entityType, entityId, data);
    return store.upsertMetadata(entityType, entityId, suggestion, data);
  }
}

const metadataService = new MetadataService();
module.exports = metadataService;