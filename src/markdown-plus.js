import $ from 'jquery'
import Cookies from 'js-cookie'
import ace from 'brace'

import { syncEditor } from './sync_scroll'
import editor from './editor'
import { getNormalPreviewWidth, lazyChange, lazyResize } from './util'
import layout from './layout'

const promptForValue = (key, action) => {
  $(document).on('opened', '#' + key + '-modal', () => {
    $('#' + key + '-code').focus()
  })
  $('#' + key + '-code').keyup((e) => {
    if (e.which === 13) { // press enter to confirm
      $('#' + key + '-confirm').click()
    }
  })
  $(document).on('confirmation', '#' + key + '-modal', () => {
    const value = $('#' + key + '-code').val().trim()
    if (value.length > 0) {
      action(value)
      $('#' + key + '-code').val('')
    }
  })
}
// modals
$(document).on('closed', '.remodal', (e) => {
  editor.focus()
})

const Vim = ace.require('ace/keyboard/vim').CodeMirror.Vim // vim commands
Vim.defineEx('write', 'w', (cm, input) => {
  console.log('write')
})
Vim.defineEx('quit', 'q', (cm, input) => {
  if (input.input === 'q') {
    console.log('quit')
  } else if (input.input === 'q!') {
    console.log('quit without warning')
  }
})
Vim.defineEx('wq', 'wq', (cm, input) => {
  console.log('write then quit')
})

$(() => {
  // keep layout percentage after window resizing
  $(window).resize(() => {
    lazyResize()
  })

  // load themes
  let customCssFiles = Cookies.get('custom-css-files')
  if (customCssFiles === undefined) {
    customCssFiles = ''
  }
  customCssFiles.split('\n').forEach((cssfile) => {
    cssfile = cssfile.trim()
    if (cssfile.length > 0) {
      $('head').append('<link rel="stylesheet" href="' + cssfile + '"/>')
    }
  })

  // load plugins
  let customJsFiles = Cookies.get('custom-js-files')
  if (customJsFiles === undefined) {
    customJsFiles = ''
  }
  customJsFiles.split('\n').forEach((jsFile) => {
    jsFile = jsFile.trim()
    if (jsFile.length > 0) {
      $('head').append('<script src="' + jsFile + '"></script>')
    }
  })

  // scroll past end
  $('article#preview').css('padding-bottom', ($('.ui-layout-east').height() - parseInt($('article#preview').css('line-height')) + 1) + 'px')

  // left scroll with right
  $('.ui-layout-east').scroll(() => {
    syncEditor()
  })

  // whenever user changes markdown...
  editor.session.on('change', () => {
    lazyChange()
  })

  // h1 - h6 heading
  $('.heading-icon').click(() => {
    const level = $(this).data('level')
    const p = editor.getCursorPosition()
    p.column += level + 1 // cursor offset
    editor.navigateTo(editor.getSelectionRange().start.row, 0) // navigateLineStart has issue when there is wrap
    editor.insert('#'.repeat(level) + ' ')
    editor.moveCursorToPosition(p) // restore cursor position
    editor.focus()
  })

  // styling icons
  $('.styling-icon').click(() => {
    const modifier = $(this).data('modifier')
    const range = editor.selection.smartRange()
    const p = editor.getCursorPosition()
    p.column += modifier.length // cursor offset
    editor.session.replace(range, modifier + editor.session.getTextRange(range) + modifier)
    editor.moveCursorToPosition(p) // restore cursor position
    editor.selection.clearSelection() // don't know why statement above selects some text
    editor.focus()
  })

  // <hr/>
  $('#horizontal-rule').click(() => {
    const p = editor.getCursorPosition()
    if (p.column === 0) { // cursor is at line start
      editor.selection.clearSelection()
      editor.insert('\n---\n')
    } else {
      editor.navigateTo(editor.getSelectionRange().start.row, Number.MAX_VALUE) // navigateLineEnd has issue when there is wrap
      editor.insert('\n\n---\n')
    }
    editor.focus()
  })

  // list icons
  $('.list-icon').click(() => {
    const prefix = $(this).data('prefix')
    const p = editor.getCursorPosition()
    p.column += prefix.length // cursor offset
    const range = editor.selection.getRange()
    for (let i = range.start.row + 1; i < range.end.row + 2; i++) {
      editor.gotoLine(i)
      editor.insert(prefix)
    }
    editor.moveCursorToPosition(p) // restore cursor position
    editor.focus()
  })

  $('#link-icon').click(() => {
    const range = editor.selection.smartRange()
    let text = editor.session.getTextRange(range)
    if (text.trim().length === 0) {
      text = $(this).data('sample-text')
    }
    const url = $(this).data('sample-url')
    editor.session.replace(range, '[' + text + '](' + url + ')')
    editor.focus()
  })

  $('#image-icon').click(() => {
    let text = editor.session.getTextRange(editor.selection.getRange()).trim()
    if (text.length === 0) {
      text = $(this).data('sample-text')
    }
    const url = $(this).data('sample-url')
    editor.insert('![' + text + '](' + url + ')')
    editor.focus()
  })

  $('#code-icon').click(() => {
    const text = editor.session.getTextRange(editor.selection.getRange()).trim()
    editor.insert('\n```\n' + text + '\n```\n')
    editor.focus()
    editor.navigateUp(2)
    editor.navigateLineEnd()
  })

  $('#table-icon').click(() => {
    const sample = $(this).data('sample')
    editor.insert('') // delete selected
    const p = editor.getCursorPosition()
    if (p.column === 0) { // cursor is at line start
      editor.selection.clearSelection()
      editor.insert('\n' + sample + '\n\n')
    } else {
      editor.navigateTo(editor.getSelectionRange().start.row, Number.MAX_VALUE)
      editor.insert('\n\n' + sample + '\n')
    }
    editor.focus()
  })

  // emoji icon
  promptForValue('emoji', (value) => {
    if (/^:.+:$/.test(value)) {
      value = /^:(.+):$/.exec(value)[1]
    }
    editor.insert(':' + value + ':')
  })

  // Font Awesome icon
  promptForValue('fa', (value) => {
    if (value.substring(0, 3) === 'fa-') {
      value = value.substring(3)
    }
    editor.insert(':fa-' + value + ':')
  })

  $('#math-icon').click(() => {
    let text = editor.session.getTextRange(editor.selection.getRange()).trim()
    if (text.length === 0) {
      text = $(this).data('sample')
    }
    editor.insert('\n```katex\n' + text + '\n```\n')
    editor.focus()
  })

  $('.mermaid-icon').click(() => {
    let text = editor.session.getTextRange(editor.selection.getRange()).trim()
    if (text.length === 0) {
      text = $(this).data('sample')
    }
    editor.insert('\n```mermaid\n' + text + '\n```\n')
    editor.focus()
  })

  $('#toggle-toolbar').click(() => {
    layout.toggle('north')
  })

  $('#toggle-editor').click(() => {
    if (layout.panes.center.outerWidth() < 8) { // editor is hidden
      layout.sizePane('east', getNormalPreviewWidth())
    } else {
      layout.sizePane('east', '100%')
    }
  })

  $('#toggle-preview').click(() => {
    if (layout.panes.east.outerWidth() < 8) { // preview is hidden
      layout.sizePane('east', getNormalPreviewWidth())
    } else {
      layout.sizePane('east', 1)
    }
  })
})
