// This module exports function for parsing HTML. Parsing is done serially on a
// HTML string using regular expressions.
//
// ## RegExpes used for parsing
//
// See [Regular Expressions guide][regExp] to consult about RegExp pattern
// syntax.
//
// [regExp]: https://developer.mozilla.org/en-US/docs/JavaScript/Guide/Regular_Expressions
//
// ### Start tag
//
// Does not matches HTML comments `<!` and end tags `</`. Captures tag name,
// attributes string and a mark of an empty tag.
//
// For `<hr/>` captured tag name will be `hr`, for `<bootstrap:dropdown>` it
// will be `bootstrap:dropdown`.
//
// Attributes string will be `href="test"` (with leading spaces) for
// `<a href="test">A</a>` input.
//
// The last capture, the mark of an empty tag, will be either an empty string
// or `/`.

/* Deconstruction of a RegExp for a start tag

    /^<              -- matches strings starting from '<' character
      ([^\s=\/!>]+)  -- capture tag name
      (              -- capture attributes string
        (?:
          \s+
          [^\s=\/>]+
          (?:
            \s*=\s*
            (?:
              (?:"[^"]*")
            | (?:'[^']*')
            | [^>\s]+
            )?
          )?
        )*
      )
      \s*
      (\/?)          -- capture mark of an empty tag
      \s*
      >              -- matches up to closing bracket
    /
 */
var startTag = /^<([^\s=\/!>]+)((?:\s+[^\s=\/>]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+)?)?)*)\s*(\/?)\s*>/
  , endTag = /^<\/([^\s=\/!>]+)[^>]*>/
  , comment = /^<!--([\s\S]*?)-->/
  , commentInside = /<!--[\s\S]*?-->/
  , other = /^<([\s\S]*?)>/
  , attr = /([^\s=]+)(?:\s*(=)\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+))?)?/g
  , rawTagsDefault = /^(style|script)$/i

function empty() {}

function matchEndDefault(tagName) {
  return new RegExp('</' + tagName, 'i')
}

// Called from `parse` function when start tag is matched on the start of a
// `html`.
function onStartTag(html, match, handler) {
  var attrs = {}
    , tag = match[0]
    , tagName = match[1]
    , remainder = match[2]
  html = html.slice(tag.length)

  remainder.replace(attr, function(match, name, equals, attr0, attr1, attr2) {
    attrs[name.toLowerCase()] = attr0 || attr1 || attr2 || (equals ? '' : null)
  })
  handler(tag, tagName.toLowerCase(), attrs, html)

  return html
}

function onTag(html, match, handler) {
  var tag = match[0]
    , data = match[1]
  html = html.slice(tag.length)

  handler(tag, data, html)

  return html
}

function onText(html, index, isRawText, handler) {
  var text
  if (~index) {
    text = html.slice(0, index)
    html = html.slice(index)
  } else {
    text = html
    html = ''
  }

  if (text) handler(text, isRawText, html)

  return html
}

function rawEnd(html, ending, offset) {
  offset || (offset = 0)
  var index = html.search(ending)
    , commentMatch = html.match(commentInside)
    , commentEnd
  // Make sure that the ending condition isn't inside of an HTML comment
  if (commentMatch && commentMatch.index < index) {
    commentEnd = commentMatch.index + commentMatch[0].length
    offset += commentEnd
    html = html.slice(commentEnd)
    return rawEnd(html, ending, offset)
  }
  return index + offset
}

// ## Exports `parse` function
//
// ### Options
//
// Handles:
//
// *   `start` Function
//
//     Optional. Will be called with `(tag, tagName, attrs, html)` where
//     `tag` is a String containing full start tag (e.g. `<a href="test">`),
//     `tagName` is a lower-cased name of a tag, `attrs` is an Object map of
//     lower-cased attribute names and it's original values, and `html` is the
//     remaining HTML after parsed start tag. See `onStartTag` function for
//     details.
//
// *   `end` Function
//
//     Optional. Will be called with `(tag, data, html)` where `tag` is a String
//     containing full end tag, e.g. `</a>`; `data` is a lower-cased tag name of
//     an end tag. See `onTag` function for details.
//
// *   `text` Function
//
//     Optional. Will be called with `(text, isRawText, html)` where text is a
//     String of a parsed text, `isRawText` is a Boolean telling if text was
//     parsed from inside the raw tags defined by `rawTags` option. See `onText`
//     function for details.
//
// *   `comment` Function
//
//     Optional. Call signature is like for `end` handler, but first argument
//     will be a comment tag and second will be contents of the comment. See
//     `onTag` function for details.
//
// *   `other` Function
//
//     Optional. Call signature is like for `end` handler, but first argument
//     will be a complete tag (DOCTYPE, processing instruction) and second will
//     be contents of the `< contents >`. See `onTag` function for details.
//
// *   `error` Function. See *Handling parsing errors* section for details.
//
// Other options:
//
// *   `matchEnd` Function
//
//     Optional. Function which acceps `tagName` and returns RegExp for mathing
//     the closing tag. If not set, simple RegExp of `/<\/tagName/i` is used.
//
// *   `rawTags` RegExp
//
//     Optional. If not set, `/^(style|script)$/i` will be used.
//
// ### Handling parsing errors
//
//     // In this example, `err` is an Error object with message staring
//     // from 'HTML parse error: ' + ramaining HTML which can not be
//     // parsed.
//
//     var parse = require('html-util').parse
//
//     // handling errors with `error` callback
//     parse('<p>Test</p>', { error: function (err) {} })
//
//     // or throwing them as exceptions
//     try {
//       parse('<p>test</p>')
//     } catch (err) {
//       // handle `err` object
//     }
//
/**
 * Parse `html`
 *
 * @param  {String} html    [description]
 * @param  {Object} options Optional.
 * @return {[type]}         [description]
 */
module.exports = function(html, options) {
  if (options == null) options = {}

  if (!html) return

  var startHandler = options.start || empty
    , endHandler = options.end || empty
    , textHandler = options.text || empty
    , commentHandler = options.comment || empty
    , otherHandler = options.other || empty
    , matchEnd = options.matchEnd || matchEndDefault
    , errorHandler = options.error
    , rawTags = options.rawTags || rawTagsDefault
    , index, last, match, tagName, err

  while (html) {
    if (html === last) {
      err = new Error('HTML parse error: ' + html)
      if (errorHandler) {
        errorHandler(err)
      } else {
        throw err
      }
    }
    last = html

    if (html[0] === '<') {
      if (match = html.match(startTag)) {
        html = onStartTag(html, match, startHandler)

        tagName = match[1]
        if (rawTags.test(tagName)) {
          index = rawEnd(html, matchEnd(tagName))
          html = onText(html, index, true, textHandler)
        }
        continue
      }

      if (match = html.match(endTag)) {
        match[1] = match[1].toLowerCase()  // tagName
        html = onTag(html, match, endHandler)
        continue
      }

      if (match = html.match(comment)) {
        html = onTag(html, match, commentHandler)
        continue
      }

      if (match = html.match(other)) {
        html = onTag(html, match, otherHandler)
        continue
      }
    }

    index = html.indexOf('<')
    html = onText(html, index, false, textHandler)
  }
}
