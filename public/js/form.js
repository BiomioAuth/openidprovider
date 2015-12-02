/**
 * Form generator + validator
 * @param options
 * {
 *  message: 'Form title'
 *  fields: [
 *    {
 *      label: 'username',
 *      type: 'text:num:4:12'
*     },
*     ...
*   ]
 * @constructor
 */
var Form = function (options) {
  var self = this;

  /*
    type: '[text|password|email]:[any|num|alphanum|email]:[0-9]:[0-9]'
   */

  self.message = options.message || '';
  self.fields = [];
  self.$form = null;

  /** unique form id */
  self.UID = (((1+Math.random())*0x10000)|0).toString(16).substring(1);

  for (var i = 0; i < options.fields.length; i++) {
    var field = {};
    field.label = options.fields[i].label;
    field.id = self.UID + '__' + options.fields[i].label.replace(/ /g, "-");
    field.name = options.fields[i].label.replace(/ /g, "-");

    var parsed = options.fields[i].type.split(':');
    field.type = (typeof(parsed[0]) !== 'undefined') ? parsed[0] : 'text';
    field.validation = {};
    field.validation.type = (typeof(parsed[1]) !== 'undefined') ? parsed[1] : 'any';
    field.validation.min = (typeof(parsed[2]) !== 'undefined') ? parsed[2] : null;
    field.validation.max = (typeof(parsed[3]) !== 'undefined') ? parsed[3] : null;

    self.fields.push(field);
  }

  if (options.fields && options.fields.length) {
    self.$form = $('<form />', {id: 'form' + self.UID, onsubmit: '', method: 'POST'});
  }

  options.message && addMessage(options.message);

  for (var i = 0; i < self.fields.length; i++) {
    addField(self.fields[i]);
  }

  addButton();

  function addMessage(message) {
    var field = $('<div />', {class: 'message', text: message});
    self.$form.append(field);
  };

  function addField(fieldData) {
    var field = $('<div/>', {class: 'form-group'});
    field.append($('<label />', {for: fieldData.id}).text(fieldData.label));
    field.append($('<input />', {class: 'form-control', id: fieldData.id, name: fieldData.name, type: fieldData.type }));
    field.append($('<div />', {class: 'text-danger'}));

    self.$form.append(field);
  };

  function addButton() {
    var button = $('<button />', {onclick: "", type: "submit", class: "btn btn-default"}).text('OK');
    self.$form.append(button);
  };
};

/**
 * Place form in DOM
 * @param selector
 */
Form.prototype.append = function($el) {
  var self = this;
  self.$form.appendTo($el);

  $('#form' + this.UID).on('submit', function(e) {
    var data = $(this).serializeArray()
    e.preventDefault();

    if(self.validate() === true) {
      self.onSubmit(data);
    }

  });

  return this;
};

Form.prototype.validate = function() {
  var self = this;
  var errors = [];

  /** regexp rules */
  var rAlphanum = /^[a-z0-9]+$/i;
  var rNum = /^[0-9]+$/i;
  var rEmail = /^(([^<>()[]\.,;:s@"]+(.[^<>()[]\.,;:s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/;

  for (var i = 0; i < self.fields.length; i++) {
    var min = self.fields[i].validation.min;
    var max = self.fields[i].validation.max;
    var type = self.fields[i].validation.type;

    var fieldId = self.fields[i].id;
    var $field = $('#' + fieldId);
    var fieldValue = $field.val();
    fieldValue = fieldValue.trim();

    /** not empty */
    if (fieldValue.length === 0) {
      errors.push({
        field: $field,
        message: 'Field can`t be empty.'
      });
    }

    /** value size */
    var between  = (min !== null && max !== null && (fieldValue.length > max || fieldValue.length < min));
    var lesser  = (min === null && max !== null && fieldValue.length > max);
    var greater = (min !== null && max === null && fieldValue.length < min);
    var exactly = (min !== null && min === max && fieldValue.length !== min);

    if (between) {
      errors.push({
        field: $field,
        message: 'Field must be in range ' + min + '...' + max + '.'
      });
    } else if (lesser) {
      errors.push({
        field: $field,
        message: 'Field must be lesser then: ' + max + '.'
      });
    } else if (greater) {
      errors.push({
        field: $field,
        message: 'Field must be greater then: ' + min + '.'
      });
    } else if (exactly) {
      errors.push({
        field: $field,
        message: 'Field must have a size: ' + min + '.'
      });
    }

    /** value type */
    switch(type) {
      case 'alphanum':
        if(!rAlphanum.test(fieldValue)) {
          errors.push({
            field: $field,
            message: 'Field must have only alpha and numeric symbols.'
          });
        }
        break;
      case 'num':
        if(!rNum.test(fieldValue)) {
          errors.push({
            field: $field,
            message: 'Field must have only numeric symbols.'
          });
        }
        break;
      case 'email':
        if(!rEmail.test(fieldValue)) {
          errors.push({
            field: $field,
            message: 'Field must be an email.'
          });
        }
        break;
      case 'any':
      default:
        /** field with any symbols (not empty) passed test */
    }

  }

  /** clear all previous errors */
  self.$form.find('p.text-danger').html('');

  /** display errors, if they exist */
  for(var i = 0; i < errors.length; i++) {
    var $field = errors[i].field;
    var message = errors[i].message;
    $field.siblings('div.text-danger').append($('<div />').html(message));
  }

  return (errors.length > 0 ? false : true);
};

Form.prototype.onSubmit = function(data) {
  console.info('Please override onSubmit method to handle form submit event!');
  return this;
};