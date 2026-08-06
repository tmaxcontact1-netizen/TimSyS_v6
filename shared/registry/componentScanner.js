'use strict';

const fs = require('fs');
const path = require('path');
const componentRegistry = require('./componentRegistry');
const moduleRegistry = require('./moduleRegistry');
const log = require('../services/log');

const MODULES_DIR = path.resolve(__dirname, '../../modules');

/**
 * Scan all modules and auto-register their components.
 * Called during boot after modules are wired but before boot hooks execute.
 * 
 * Looks for:
 * - component.json files in each module directory
 * - Components declared in module.json under "provides" (capability:prefix)
 */
function scan() {
  if (!fs.existsSync(MODULES_DIR)) {
    log.warn('Components directory not found, skipping component scan', { path: MODULES_DIR });
    return [];
  }

  const moduleDirs = fs.readdirSync(MODULES_DIR).filter(function(d) {
    var stat = fs.statSync(path.join(MODULES_DIR, d));
    return stat.isDirectory() && d !== '.gitkeep';
  });

  const componentsFound = [];

  moduleDirs.forEach(function(modName) {
    const modDir = path.join(MODULES_DIR, modName);
    
    // Look for explicit component.json
    const componentFile = path.join(modDir, 'component.json');
    if (fs.existsSync(componentFile)) {
      try {
        const componentSpec = JSON.parse(fs.readFileSync(componentFile, 'utf8'));
        componentSpec.ownerModule = modName;
        
        componentRegistry.register(componentSpec);
        componentsFound.push({
          name: componentSpec.name,
          module: modName,
          type: componentSpec.type || 'generic'
        });
        
        log.info('Registered component from component.json', { 
          component: componentSpec.name, 
          module: modName 
        });
      } catch (err) {
        log.error('Failed to parse component.json', { 
          module: modName, 
          error: err.message 
        });
      }
      return;
    }

    // Infer components from capability declarations in module.json
    const manifestFile = path.join(modDir, 'module.json');
    if (fs.existsSync(manifestFile)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        
        if (manifest.provides && Array.isArray(manifest.provides)) {
          manifest.provides.forEach(function(provision) {
            // Parse "capability:name" or just "name"
            const parts = provision.split(':');
            
            if (parts[0] === 'capability' && parts[1]) {
              // This module provides a capability component
              const compName = parts[1];
              
              // Extract routes/schema from manifest for this component
              const routes = manifest.routes ? manifest.routes.map(function(r) {
                return { path: r.path, method: r.method, handler: r.handler };
              }) : null;
              
              const schema = manifest.schema || null;
              const capabilities = manifest.provides || null;
              const events = manifest.events || null;
              
              const inferredComponent = {
                name: compName,
                type: inferComponentType(compName),
                ownerModule: modName,
                dependencies: manifest.requires || [],
                routes: routes,
                schema: schema,
                capabilities: capabilities,
                events: events
              };
              
              componentRegistry.register(inferredComponent);
              componentsFound.push({
                name: compName,
                module: modName,
                type: inferredComponent.type
              });
              
              log.info('Inferred component from capability', {
                component: compName,
                module: modName,
                type: inferredComponent.type
              });
            }
          });
        }
      } catch (err) {
        log.error('Failed to parse module.json during scan', {
          module: modName,
          error: err.message
        });
      }
    }
  });

  log.info('Component scan complete', { count: componentsFound.length });
  return componentsFound;
}

/**
 * Infer component type from name/convention.
 * staff_registry → registry
 * room_allocation → allocation
 * inventory → inventory
 * etc.
 */
function inferComponentType(name) {
  var lower = name.toLowerCase();
  
  if (lower.includes('registry')) return 'registry';
  if (lower.includes('allocation') || lower.includes('room')) return 'allocation';
  if (lower.includes('inventory') || lower.includes('equipment')) return 'inventory';
  if (lower.includes('medical') || lower.includes('health')) return 'medical';
  if (lower.includes('attendance') || lower.includes('schedule')) return 'scheduling';
  if (lower.includes('incident') || lower.includes('report')) return 'reporting';
  
  return 'generic';
}

function clear() {
  componentRegistry.clear();
  log.info('Component registry cleared');
}

module.exports = {
  scan: scan,
  inferComponentType: inferComponentType,
  clear: clear
};