var Form = function (options) {
  var self = this;

  self.message = options.message || '';
  self.fields = [];
  self.$form = null;

  /** unique form id */
  self.UID = (((1+Math.random())*0x10000)|0).toString(16).substring(1);

  for (var i = 0; i < options.fields.length; i++) {
    var field = {};
    field.label = options.fields[i].label;
    field.id = options.fields[i].label.replace(/ /g, "-");
    field.name = options.fields[i].label.replace(/ /g, "-");

    var parsed = options.fields[i].type.split(':');
    field.type = (typeof(parsed[0]) !== 'undefined') ? parsed[0] : 'text';
    field.validation = {};
    field.validation.type = (typeof(parsed[1]) !== 'undefined') ? parsed[1] : 'alphanum';
    field.validation.min = (typeof(parsed[2]) !== 'undefined') ? parsed[2] : 0;
    field.validation.max = (typeof(parsed[3]) !== 'undefined') ? parsed[3] : 999;

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

    self.$form.append(field);
  };

  function addButton() {
    var button = $('<button />', {onclick: "", type: "submit", class: "btn btn-default"}).text('OK');
    self.$form.append(button);
  };
};