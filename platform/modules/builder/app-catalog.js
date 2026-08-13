'use strict';

// MemecoinEd is deliberately absent: it is an independently supervised product.
const ADMIN_APPS = Object.freeze([
  { id: 'principal-ed', displayName: "Principal'Ed", description: 'School administration and leadership', implemented: true },
  { id: 'competeed', displayName: "Compete'Ed", description: 'Competition and performance administration', implemented: false },
  { id: 'sanctifyed', displayName: "Sanctify'Ed", description: 'Safeguarding and compliance administration', implemented: false }
]);

const ESSENTIAL_SERVICES = Object.freeze([
  'db', 'cache', 'auth', 'log', 'validate', 'events'
].map(function(name) { return { name: name, essential: true, enabled: true, removable: false }; }));

function get(appId) { return ADMIN_APPS.find(function(app) { return app.id === appId; }) || null; }

module.exports = { all: function() { return ADMIN_APPS.slice(); }, get: get, essentialServices: function() { return ESSENTIAL_SERVICES.slice(); } };
