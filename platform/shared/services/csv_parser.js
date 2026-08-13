'use strict';

function parse(buffer, options) {
  options = options || {};
  var delimiter = options.delimiter || ',';
  var hasHeaderRow = options.hasHeader !== false;

  var text = buffer.toString('utf-8');
  var rows = _parseRows(text, delimiter);

  if (!hasHeaderRow) {
    return { headers: [], rows: rows };
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  var headers = rows[0];
  var dataRows = rows.slice(1);
  var objects = [];

  for (var i = 0; i < dataRows.length; i++) {
    if (dataRows[i].length === 1 && dataRows[i][0] === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = dataRows[i][j] !== undefined ? dataRows[i][j] : '';
    }
    objects.push(obj);
  }

  return { headers: headers, rows: objects };
}

function _parseRows(text, delimiter) {
  var rows = [];
  var currentRow = [];
  var currentField = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var char = text[i];
    var nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapRow(row, columnMap) {
  var mapped = {};
  var unmapped = {};

  for (var key in row) {
    var normKey = normalizeHeader(key);
    if (columnMap[normKey]) {
      mapped[columnMap[normKey]] = row[key];
    } else {
      unmapped[key] = row[key];
    }
  }

  return { mapped: mapped, unmapped: unmapped };
}

function mapRows(rows, columnMap) {
  var results = [];
  for (var i = 0; i < rows.length; i++) {
    results.push(mapRow(rows[i], columnMap));
  }
  return results;
}

function importedValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function prepareImportedRow(mappedResult, options) {
  options = options || {};
  var row = Object.assign({}, mappedResult.mapped);
  var warnings = [];
  var required = options.required || [];
  for (var i = 0; i < required.length; i++) {
    var field = required[i];
    row[field] = importedValue(row[field]);
    if (!row[field]) warnings.push('Missing ' + field);
  }
  var identifier = options.identifier;
  if (identifier && !row[identifier]) {
    row[identifier] = 'IMPORT-' + String(options.entity || 'RECORD').toUpperCase() + '-' + Date.now() + '-' + options.rowNumber;
    warnings.push('Generated temporary ' + identifier + ' because the source value was missing');
  }
  var unsupported = Object.keys(mappedResult.unmapped || {}).filter(function(key) {
    return importedValue(mappedResult.unmapped[key]) !== '';
  });
  if (unsupported.length) warnings.push('Unrecognised columns retained in import metadata: ' + unsupported.join(', '));
  return {
    row: row,
    warnings: warnings,
    customFields: {
      csv_import: {
        source_row: options.rowNumber,
        warnings: warnings,
        unmapped: mappedResult.unmapped || {}
      }
    }
  };
}

module.exports = {
  parse: parse,
  normalizeHeader: normalizeHeader,
  mapRow: mapRow,
  mapRows: mapRows,
  prepareImportedRow: prepareImportedRow
};
