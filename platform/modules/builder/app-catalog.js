'use strict';

const ADMIN_APPS = Object.freeze([
  { id: 'principal-ed', displayName: "Principal'Ed", description: 'School administration and leadership', implemented: true, composition: 'platform-modules' },
  { id: 'memecoined', displayName: "MemeCoin'Ed", description: 'Market research and supervised paper trading', implemented: true, composition: 'independent-domain' },
  { id: 'dressed', displayName: "Dress'Ed", description: 'Wardrobe management and outfit coordination', implemented: true, composition: 'independent-domain' },
  { id: 'researched', displayName: "Research'Ed", description: 'Auditable research design, corpus and evidence analysis', implemented: true, composition: 'independent-domain' },
]);

const ESSENTIAL_SERVICES = Object.freeze([
  'db', 'cache', 'auth', 'log', 'validate', 'events'
].map(function(name) { return { name: name, essential: true, enabled: true, removable: false }; }));

function get(appId) { return ADMIN_APPS.find(function(app) { return app.id === appId; }) || null; }

module.exports = { all: function() { return ADMIN_APPS.slice(); }, get: get, essentialServices: function() { return ESSENTIAL_SERVICES.slice(); } };
