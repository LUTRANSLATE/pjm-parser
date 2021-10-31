const lineReader = require("line-reader");
const Promise = require("bluebird");
const eachLine = Promise.promisify(lineReader.eachLine);

module.exports = (fileLocation, callback) => {
  var output = [];
  var data = [];
  var readingPropertyValues = false,
    readingOneForMany = false;

  eachLine(fileLocation, (line) => {
    var comment = /::/g;
    var isComment = comment.exec(line);

    if (!isComment && line.length) {
      line = line.replace(/ = /g, "=");

      if (
        !readingPropertyValues &&
        !readingOneForMany &&
        !line.includes("PROPERTY && VALUES") &&
        !line.includes("ONE FOR MANY")
      ) {
        output.push(line);
      } else {
        data.push(line);
      }

      if (line.match(/<PROPERTY && VALUES>/g)) readingPropertyValues = true;
      if (line.match(/<ONE FOR MANY>/g)) readingOneForMany = true;
      if (line.match(/<\/PROPERTY && VALUES>/g)) readingPropertyValues = false;
      if (line.match(/<\/ONE FOR MANY>/g)) readingOneForMany = false;
    }
  })
    .then(function () {
      if (!data.length) return render();
      var propertyValuesReg =
        /<PROPERTY && VALUES>(.*?)<\/PROPERTY && VALUES>/g;
      var oneForManyReg = /<ONE FOR MANY>(.*?)<\/ONE FOR MANY>/g;
      var targetReg = /<TARGET>(.*?)<\/TARGET>/g;
      var entryReg = /<ENTRY>(.*?)<\/ENTRY>/g;
      var template = data.join("");
      let oneForManyNodes = template.match(oneForManyReg);

      if (oneForManyNodes) {
        oneForManyNodes.forEach((child) => {
          var value = child.match(targetReg);
          if (!value)
            return callback(
              new Error(`no <target> set @ ${oneForManyNodes}`),
              null
            );
          var entries = child.match(entryReg);
          if (!entries)
            return callback(
              new Error(`no <entry> set @ ${oneForManyNodes}`),
              null
            );
          entries.forEach((entry) => {
            output.push(removeTags(entry) + "=" + removeTags(value[0]));
          });
        });
      }

      let propertyValuesNode = template.match(propertyValuesReg);

      if (propertyValuesNode) {
        propertyValuesNode.forEach((pv) => {
          var propertyValueChildren = pv.match(targetReg);
          if (!propertyValueChildren) {
            return callback(
              new Error(`no <rule> set @ ${propertyValuesNode}`),
              null
            );
          }
          var entryChildren = pv.match(entryReg);

          if (!entryChildren) {
            return callback(
              new Error(`no <entry> set @ ${propertyValuesNode}`),
              null
            );
          }

          propertyValueChildren.forEach((pvChild) => {
            var pv = pvChild
              .replace(/<(.*?)>/g, "")
              .replace(/<\/(.*?)>/g, "")
              .replace(/ && /g, "&&")
              .split("&&");

            if (!pv[0])
              return callback(new Error(`no property set @ ${pvChild}`), null);
            if (!pv[1])
              return callback(new Error(`no value set @ ${pvChild}`), null);

            entryChildren.forEach((entry) => {
              output.push(
                entry
                  .replace(/%{property}/g, pv[0])
                  .replace(/%{value}/g, pv[1])
                  .replace(/<(.*?)>/g, "")
                  .replace(/<\/(.*?)>/g, "")
              );
            });
          });
        });
      }

      render();
    })
    .catch(function (err) {
      callback(err, null);
    });

  function removeTags(child) {
    return child.replace(/<(.*?)>/g, "").replace(/<\/(.*?)>/g, "");
  }

  function render() {
    var obj = {};
    output.forEach(function (line) {
      line = line.replace(/\?/g, "").replace(/\!/g, "").split("=");
      obj[line[0]] = line[1];
    });

    return callback(null, obj);
  }
};
