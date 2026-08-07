#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

var serverPort = process.env.PORT || 3000;
var serverHost = process.env.HOST || 'localhost';

function makeRequest(requestPath, token, callback, method, body) {
  var options = {
    hostname: serverHost,
    port: serverPort,
    path: requestPath,
    method: method || 'GET',
    headers: {}
  };
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  if (body) options.headers['Content-Type'] = 'application/json';
  
  var req = http.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try { callback(null, JSON.parse(data)); }
      catch(e) { callback(e, null); }
    });
  });
  req.on('error', function(err) { callback(err, null); });
  if (body) req.write(JSON.stringify(body));
  req.end();
}

function scaffoldNew(name) {
  var MODULES_DIR = path.resolve(__dirname, '../../modules');
  var moduleDir = path.join(MODULES_DIR, name);
  var migrationsDir = path.join(moduleDir, 'migrations');
  if (fs.existsSync(moduleDir)) {
    console.error('Error: Module "' + name + '" already exists at ' + moduleDir);
    process.exit(1);
  }
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  var manifest = {
    name: name, version: '1.0.0', author: 'internal',
    dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
    provides: [], requires: [], routes: [], functions: [],
    schema: { tables: [], migrations: [] },
    events: { publishes: [], subscribes: [] }
  };
  fs.writeFileSync(path.join(moduleDir, 'module.json'), JSON.stringify(manifest, null, 2) + '\n');
  var indexJs = [
    "'use strict';", '',
    'var moduleJson = require("./module.json");', '',
    'module.exports = {',
    '  boot(ctx) {',
    '    // Initialize module',
    '  },',
    '  teardown(ctx) {',
    '    // Cleanup module',
    '  }',
    '};', ''
  ].join('\n');
  fs.writeFileSync(path.join(moduleDir, 'index.js'), indexJs);
  fs.writeFileSync(path.join(migrationsDir, '.gitkeep'), '');
  console.log('Created module "' + name + '" at ' + moduleDir);
  console.log('  - module.json');
  console.log('  - index.js');
  console.log('  - migrations/.gitkeep');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Add routes to module.json');
  console.log('  2. Implement handlers in index.js');
  console.log('  3. Create migrations in migrations/');
  console.log('  4. Restart server to stage module');
}

function inspectModule(name, token) {
  makeRequest('/introspect/gaps?module=' + encodeURIComponent(name), token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running. Use --port to specify a different port.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error: ' + (result.error ? result.error.message : 'Unknown error'));
      process.exit(1);
    }
    var gaps = result.gaps;
    console.log('\nGap Analysis: ' + gaps.moduleName);
    console.log('================' + '='.repeat(gaps.moduleName.length));
    console.log('Completion: ' + gaps.completionScore + '% (' + gaps.status + ')');
    console.log('');
    if (gaps.metrics) {
      console.log('Metrics:');
      console.log('  Capability Coverage:  ' + gaps.metrics.capabilityCoverage + '%');
      console.log('  Function Completeness: ' + gaps.metrics.functionCompleteness + '%');
      console.log('  Route Completeness:   ' + gaps.metrics.routeCompleteness + '%');
      console.log('  Schema Completeness:  ' + gaps.metrics.schemaCompleteness + '%');
    }
    if (gaps.gaps && gaps.gaps.length > 0) {
      console.log('\nGaps:');
      for (var i = 0; i < gaps.gaps.length; i++) {
        var gap = gaps.gaps[i];
        console.log('  [' + gap.priority.toUpperCase() + '] ' + gap.category + ': ' + gap.missing.join(', '));
      }
    }
    if (gaps.recommendedActions && gaps.recommendedActions.length > 0) {
      console.log('\nRecommended Actions:');
      for (var j = 0; j < gaps.recommendedActions.length; j++) {
        console.log('  ' + (j + 1) + '. ' + gaps.recommendedActions[j]);
      }
    }
    console.log('');
  });
}

function recommend(token, intent) {
  var url = '/introspect/templates';
  if (intent) url += '?intent=' + encodeURIComponent(intent);
  makeRequest(url, token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error: ' + (result.error ? result.error.message : 'Unknown error'));
      process.exit(1);
    }
    var templates = result.templates;
    console.log('\nRecommendations:');
    console.log('================');
    console.log('');
    if (templates.platformReadiness) {
      var pr = templates.platformReadiness;
      console.log('Platform Readiness:');
      console.log('  Available Capabilities: ' + pr.availableCapabilities);
      console.log('  Staged Modules:          ' + pr.stagedModules);
      console.log('  Orphan Capabilities:    ' + pr.orphanCapabilities);
      console.log('  Partial Modules:        ' + pr.partialModules);
      console.log('  Missing Modules:        ' + pr.missingModules);
      console.log('');
    }
    if (templates.suggestions && templates.suggestions.length > 0) {
      console.log('Suggestions:');
      for (var i = 0; i < templates.suggestions.length; i++) {
        var s = templates.suggestions[i];
        console.log('  ' + (i + 1) + '. ' + s.moduleName + ' (confidence: ' + (s.confidence * 100).toFixed(0) + '%)');
        console.log('     Action: ' + s.action);
        console.log('     Effort: ' + s.estimatedEffort);
        console.log('     Missing Artifacts: ' + s.missingArtifacts);
        if (s.recommendedNextSteps && s.recommendedNextSteps.length > 0) {
          console.log('     Next Steps:');
          for (var j = 0; j < s.recommendedNextSteps.length; j++) {
            console.log('       - ' + s.recommendedNextSteps[j]);
          }
        }
        console.log('');
      }
    } else {
      console.log('No suggestions available.\n');
    }
  });
}

function completeModule(name, token) {
  makeRequest('/introspect/gaps?module=' + encodeURIComponent(name), token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error: ' + (result.error ? result.error.message : 'Unknown error'));
      process.exit(1);
    }
    var gaps = result.gaps;
    console.log('\nCompletion Checklist: ' + gaps.moduleName);
    console.log('======================' + '='.repeat(gaps.moduleName.length));
    console.log('Current: ' + gaps.completionScore + '% (' + gaps.status + ')');
    console.log('Target:  100%');
    console.log('');
    if (gaps.gaps && gaps.gaps.length > 0) {
      console.log('Remaining Work:');
      for (var i = 0; i < gaps.gaps.length; i++) {
        var gap = gaps.gaps[i];
        for (var j = 0; j < gap.missing.length; j++) {
          console.log('  [ ] ' + gap.missing[j] + ' (' + gap.category + ', ' + gap.priority + ')');
        }
      }
    } else {
      console.log('Module is at 100% completion. No remaining work.\n');
    }
    if (gaps.recommendedActions && gaps.recommendedActions.length > 0) {
      console.log('\nAction Items:');
      for (var k = 0; k < gaps.recommendedActions.length; k++) {
        console.log('  ' + (k + 1) + '. ' + gaps.recommendedActions[k]);
      }
    }
    console.log('');
  });
}

function listComponents(token) {
  makeRequest('/builder/components', token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error: ' + (result.error ? result.error.message : 'Unknown error'));
      process.exit(1);
    }
    var comps = result.components;
    console.log('\nRegistered Components (' + (comps.length || 0) + '):');
    console.log('=========================');
    console.log('');
    if (!comps || comps.length === 0) {
      console.log('No components registered. Run component scanner or register components manually.\n');
      return;
    }
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i];
      console.log('  ' + (i + 1) + '. ' + c.name);
      console.log('     Type: ' + c.type);
      console.log('     Owner: ' + (c.ownerModule || 'none'));
      console.log('     Dependencies: ' + (c.dependencies ? c.dependencies.length : 0));
      console.log('');
    }
  });
}

function composeModule(name, componentList, token) {
  var input = {
    name: name,
    components: componentList.split(',')
  };
  
  makeRequest('/builder/compose', token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error composing module: ' + (result.error ? result.error.message : 'Unknown error'));
      if (result.error && result.error.missingComponents) {
        console.log('\nMissing components: ' + result.error.missingComponents.join(', '));
      }
      process.exit(1);
    }
    
    var spec = result.spec;
    console.log('\nComposition Result:');
    console.log('==================');
    console.log('Module: ' + spec.manifest.name);
    console.log('Version: ' + spec.manifest.version);
    console.log('Components: ' + spec.components.length);
    console.log('');
    
    if (spec.warnings && spec.warnings.length > 0) {
      console.log('Warnings:');
      spec.warnings.forEach(function(w) {
        console.log('  ⚠ ' + w);
      });
      console.log('');
    }
    
    if (spec.conflicts && spec.conflicts.length > 0) {
      console.log('Conflicts:');
      spec.conflicts.forEach(function(c) {
        console.log('  ✖ ' + c.details);
      });
      console.log('');
    }
    
    console.log('Manifest Preview:');
    console.log(JSON.stringify(spec.manifest, null, 2));
    console.log('');
  }, 'POST', input);
}

function validateModule(name, componentList, token) {
  var input = {
    name: name,
    components: componentList.split(',')
  };
  
  makeRequest('/builder/validate', token, function(err, result) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      console.error('Make sure TimSyS is running.');
      process.exit(1);
    }
    if (!result.success) {
      console.error('Error validating module: ' + (result.error ? result.error.message : 'Unknown error'));
      process.exit(1);
    }
    
    var validation = result.validated;
    console.log('\nValidation Result:');
    console.log('================');
    
    if (!validation.composition.success) {
      console.log('✖ Composition failed: ' + (validation.composition.error ? validation.composition.error.message : 'Unknown error'));
      process.exit(1);
    }
    
    if (!validation.assemblyPreview.success) {
      console.log('✖ Assembly failed: ' + (validation.assemblyPreview.error ? validation.assemblyPreview.error.message : 'Unknown error'));
      process.exit(1);
    }
    
    console.log('✔ Composition valid');
    console.log('✔ Assembly preview passed');
    console.log('');
    console.log('Module: ' + (input.name || 'test-module'));
    console.log('Components: ' + validation.composition.spec.components.length);
    console.log('Routes: ' + validation.composition.spec.manifest.routes.length);
    console.log('Tables: ' + validation.composition.spec.manifest.schema.tables.length);
    console.log('');
  }, 'POST', input);
}

function buildModule(name, componentList, token, dryRun) {
  var input = {
    name: name,
    components: componentList.split(',')
  };
  
  // First compose
  makeRequest('/builder/compose', token, function(err, composeResult) {
    if (err) {
      console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
      process.exit(1);
    }
    if (!composeResult.success) {
      console.error('Error: Composition failed');
      process.exit(1);
    }
    
    var spec = {
      name: input.name,
      components: input.components,
      routes: composeResult.spec.manifest.routes,
      schema: composeResult.spec.manifest.schema,
      events: composeResult.spec.manifest.events
    };
    
    var path = '/builder/assemble' + (dryRun ? '?dryRun=true' : '');
    makeRequest(path, token, function(err, result) {
      if (err) {
        console.error('Error: Cannot connect to server at ' + serverHost + ':' + serverPort);
        process.exit(1);
      }
      if (!result.success) {
        console.error('Error: Assembly failed');
        if (result.error) console.error(result.error.message);
        process.exit(1);
      }
      
      console.log('\nBuild Result:');
      console.log('=============');
      if (dryRun) {
        console.log('Dry run complete. Nothing written.');
        console.log('Would create module: ' + result.module.name);
        console.log('Would create files:');
        result.module.filesCreated.forEach(function(f) {
          console.log('  - ' + f);
        });
      } else {
        console.log('Module assembled successfully!');
        console.log('Path: ' + result.module.path);
        console.log('Files created:');
        result.module.filesCreated.forEach(function(f) {
          console.log('  - ' + f);
        });
        console.log('');
        console.log('Next steps:');
        result.nextSteps.forEach(function(step) {
          console.log('  ' + step);
        });
      }
    }, 'POST', spec);
  }, 'POST', input);
}

function main() {
  var args = process.argv.slice(2);
  var cmd = args[0];
  if (!cmd || cmd === 'help') {
    console.log('Usage: node scripts/cli/builder.js <command> [options]\n');
    console.log('Commands:');
    console.log('  new <name>             Scaffold a new module');
    console.log('  inspect <module>       Show gap analysis (requires running server)');
    console.log('  recommend [intent]     Show recommended builds (requires running server)');
    console.log('  complete <module>      Show remaining work to 100% (requires running server)');
    console.log('  components               List all registered components (requires running server)');
    console.log('  compose <name> <comps> Compose module from comma-separated components (requires running server)');
    console.log('  validate <name> <comps> Validate composition before build (requires running server)');
    console.log('  build <name> <comps>   Assemble module from components (requires running server)');
    console.log('  build-dryrun <name> <comps> Preview build without writing files (requires running server)');
    console.log('');
    console.log('Options:');
    console.log('  --port <number>        Server port (default: 3000)');
    console.log('  --token <jwt>          Auth token for protected endpoints');
    process.exit(0);
  }
  var positional = [];
  for (var i = 1; i < args.length; i++) {
    if (args[i] === '--port') { serverPort = parseInt(args[++i]); }
    else if (args[i] === '--token') { token = args[++i]; }
    else positional.push(args[i]);
  }
  var token = null;
  for (var k = 0; k < args.length; k++) {
    if (args[k] === '--token' && args[k+1]) { token = args[k+1]; break; }
  }
  switch (cmd) {
    case 'new':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      scaffoldNew(positional[0]);
      break;
    case 'inspect':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      inspectModule(positional[0], token);
      break;
    case 'recommend':
      recommend(token, positional[0]);
      break;
    case 'complete':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      completeModule(positional[0], token);
      break;
    case 'components':
      listComponents(token);
      break;
    case 'compose':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      if (!positional[1]) { console.error('Error: Components required (comma-separated).'); process.exit(1); }
      composeModule(positional[0], positional[1], token);
      break;
    case 'validate':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      if (!positional[1]) { console.error('Error: Components required (comma-separated).'); process.exit(1); }
      validateModule(positional[0], positional[1], token);
      break;
    case 'build':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      if (!positional[1]) { console.error('Error: Components required (comma-separated).'); process.exit(1); }
      buildModule(positional[0], positional[1], token, false);
      break;
    case 'build-dryrun':
      if (!positional[0]) { console.error('Error: Module name required.'); process.exit(1); }
      if (!positional[1]) { console.error('Error: Components required (comma-separated).'); process.exit(1); }
      buildModule(positional[0], positional[1], token, true);
      break;
    default:
      console.error('Unknown command: ' + cmd);
      process.exit(1);
  }
}
main();