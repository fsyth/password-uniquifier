(() => {

  /*===== SHA and Uniquify hashing algorithms =====*/

  // Default settings for hashing of user generated passwords
  const defaultSettings = {
    pwLength: 12,
    lowercase: true,
    uppercase: true,
    number: true,
    symbol: true,
    masterHash: 'password_not_set',
    masterSalt: 'salt_not_set',
    rememberPassword: true
  };

  // Settings for secure storage of user master passwords
  // No character types enabled returns a hex dump
  const hexSettings = {
    lowercase: false,
    uppercase: false,
    number: false,
    symbol: false
  };



  /*
   *  Runs a SHA hashing algorithm on the input str and calls a callback once
   *  the result has been computed.
   *  The buffer generated by SHA is converted into 32 bit chunks which are
   *  mapped onto the printable set of ascii characters (excluding space) with
   *  wraparound.
   *
   *  const ascii =
   *   '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
   *   .split(' ');
   *  return Array.from(new Uint32Array(hashBuffer)).map(n => ascii[n % ascii.length]).join('');
   *
   *  The range of 94 printable ascii character code points (excluding space) is from
   *  33 to 126 inclusive.
   *  This can be written more concisely as a modulo operation into String.charCodeAt
   *  n => String.fromCharCode(33 + (n % 94))
   *  but only if all printable ascii codepoints are to be included.
   */
  function sha(bits, msg, callback, settings = defaultSettings) {
    // Function that maps Uint32 chunks onto characters or strings
    var mapping;

    // Variable that holds a character placed between mapped chunks
    var joining;

    // If at least one character group is enabled, map the hash
    // characters in those groups
    if (settings.lowercase ||
        settings.uppercase ||
        settings.number ||
        settings.symbol) {

      // Generate the list of allowable characters from the settings,
      // in ascii / utf-8 code point order
      var chars = '';

      if (settings.symbol)    chars += '!"#$%&\'()*+,-./';
      if (settings.number)    chars += '0123456789';
      if (settings.symbol)    chars += ':;<=>?@';
      if (settings.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (settings.symbol)    chars += '[\]^_`';
      if (settings.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
      if (settings.symbol)    chars += '{|}~';

      chars = chars.split('');

      mapping = n => chars[n % chars.length];
      joining = '';
    } else {
      // No character types are enabled, so produce a hex dump instead
      // Pad each Uint32 chunk with zeroes to be 8 hexadecimal chars long
      // and separate each chunk with a space
      mapping = n => hexPad(n, 8);
      joining = ' ';
    }

    // Encode the string into a buffer of utf-8 code points
    var buffer = new TextEncoder('utf-8').encode(msg);

    // Pass the buffer into the crypto framework for hashing,
    // map the result onto characters and join into a string,
    // then call the callback with the result
    window.crypto.subtle.digest('SHA-' + bits, buffer)
      .then(hashBuffer =>
            Array.from(new Uint32Array(hashBuffer))
                 .map(mapping)
                 .join(joining))
      .then(callback);
  }



  /*
   *  Salts your usual password with the domain name of the website,
   *  then hashes it using SHA, before breaking the hash into 32bit uint chunks
   *  and mapping each modulo'd chunk onto an allowable password character.
   *  In this way, you can keep using your normal password without having to
   *  remember loads of different ones, while at the same time, your accounts
   *  will all have a unique password that is easy to recalculate given the domain
   *  of the website and provided you know your normal password.
   *  Also, it is impossible to reverse this process in any way to obtain your
   *  passwords.
   *  Also, this extension should never know your usernames, so even if the
   *  password was somehow compromised, an attacker would still not have enough
   *  credentials to log in.
   *  The complexity of the hashing algorithm gives a different length password:
   *  SHA-256 ->  8 character password
   *  SHA-384 -> 12 character password
   *  SHA-512 -> 16 character password
   *  Takes as arguments:
   *  pw : string, the password you use for just about everything
   *  site : string, the domain name (location.host) of the website as salt
   *  callback : function(string), where the uniquified password is its argument
   *  settings : object, containing fields for
   *    - pwLength : Number, length of the password to gen, 8 or 12 or 16
   *    - lowercase : boolean, whether to include lowercase letters
   *    - uppercase : boolean, whether to include uppercase letters
   *    - number : boolean, whether to include numbers
   *    - symbol : boolean, whether to include symbols
   */
  function uniquify(pw, site, callback, settings = defaultSettings) {
    // Ensure length is a number: 8, 12 or 16
    if (![8, 12, 16].includes(settings.pwLength)) {
      throw new RangeError('Length must be 8, 12, or 16');
    }

    // Changing the number of bits in the hashing algorithm changes the
    // number of 32 bit chunks that will be produced, which changes the
    // number of characters in the result.
    var bits = settings.pwLength * 32 | 0;

    // Hash the password salted with the site, and enforce constraints
    sha(bits, pw + site, enforceConstraints, settings);


    /*
     *  Checks to see if the generated hash contains at least one of each of the
     *  following, as required in the settings object:
     *    - lowercase letter
     *    - uppercase letter
     *    - number
     *    - symbol
     *  If the hash does not contain all of these, it will be re-hashed
     *  Otherwise, uniquify's callback will be called
     */
    function enforceConstraints(hash) {
      // Check the settings for whether lowercase, uppercase, number or symbol are required.
      // If required, at least 1 should be included
      // If not required, 0 should be included
      if ((!settings.lowercase || /[a-z]/.test(hash)) &&
          (!settings.uppercase || /[A-Z]/.test(hash)) &&
          (!settings.number || /\d/.test(hash)) &&
          (!settings.symbol || /[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/.test(hash))
         ) {
          // Hash has a good selection of character types
          // Run the callback that was passed into uniquify
          callback(hash);
      } else {
        // Otherwise, hash it again
        sha(bits, hash, enforceConstraints, settings);
      }
    }
  }


  /*
   *  Generates string of of specified length containing random printable characters
   *  Useful for generating salt.
   */
  function randomChars(len) {
    return (new Array(len)
            .fill(0)
            .map(e => String.fromCharCode(33 + 94 * Math.random() | 0))
            .join(''));
  }


  /*
   *  Generates a hexadecimal string of random values 0-f.
   *  Argument, len, is the number of characters to generate.
   */
  function randomHex(len = 2) {
    return (new Array(len)
            .fill(0)
            .map(e => (0x10 * Math.random() | 0).toString(16))
            .join(''));
  }


  /*
   *  Takes a positive integer and converts it to a hexadecimal string.
   *  The string is padded with leading zeroes to the desired length.
   */
  function hexPad(num, len = 8) {
    return ('0'.repeat(len - 1) + num.toString(16)).slice(-len);
  }



  /*===== DOM Utility Functions =====*/

  /*
   *  Adds the .hidden class to an element,
   *  which sets display:none
   */
  function hide(element) {
    element.classList.add('hidden');
  }


  /*
   *  Removes the .hidden class from an element,
   *  which sets display back to its previous value.
   */
  function show(element) {
    element.classList.remove('hidden');
  }


  /*
   *  Converts the html/css naming convention of 'some-name'
   *  to the javascript naming convention of 'someName'
   */
  function camelCase(name) {
    return name.replace(/-(\w)/g, (_, $1) => $1.toUpperCase());
  }


  /*
   *  Gets an element object by id and adds fields to it containing
   *  child elements specified by ids or classes
   *  parentId : string, the id of the parent element object to be obtained
   *  childIds : string, a space separated list of id names to be added
   *                     as fields to the parent element.
   *  childClasses : string, similarly a space separated list of classes
   *  This behaviour is designed to emulate the way that form elements
   *  contain fields for each of their named child input elements.
   *  This function extends this behaviour so that the parent element
   *  does not have to be a form, and the child elements do not have to
   *  be inputs.
   *  The returned object will have camelCased versions of any ids or
   *  classes passed in for fields.
   */
  function getForm(parentId, childIds, childClasses) {

    var form = document.getElementById(parentId);

    for (let id of childIds.split(' ')) {
      form[camelCase(id)] = document.getElementById(id);
    }

    for (let cl of childClasses.split(' ')) {
      let es = form.getElementsByClassName(cl);
      form[camelCase(cl)] = es.length === 1 ? es[0] : es;
    }

    return form;
  }



  /*===== Storage class, for both extension and webpage environments =====*/

  /*
   *  The type of storage available depends on the environment this is
   *  running in.
   *  For an extension, a chrome specific storage API is required.
   *  For the webpage, localStorage is made to emulate the chrome API.
   *  To construct the Storage object, pass in the current environment,
   *  either 'extension' or 'webpage'.
   *  var storage = new Storage('<environment>');
   *
   *  The environment this class was constructed with can be retrieved with:
   *  storage.environment
   *
   *  The underlying API is exposed with:
   *  storage.api
   *
   *  The following methods are available:
   *  storage.get(defaults, callback)
   *  storage.set(items, callback)
   *  storage.clear(callback)
   *
   *  In each case, the callback is a function run after changes to the
   *  storage area are completed.
   *  For storage.get, the callback is a function(items) in storage
   *  For the other methods, callback is a function() with no arguments.
   *
   *  For storage.get, defaults is an object where each key will be looked
   *  up in storage and each value will be the default value if the key
   *  is not found.
   *  storage.get(null, items => { ... })
   *  will retrieve all stored items and pass them into the callback.
   *  Each item should be parsed and returned as a boolean, number or
   *  string.
   *
   *  For storage.set, items is an object of the data to be stored.
   */
  function Storage(env) {

    this.environment = env;

    var noop = () => {};

    switch (env) {
      case 'extension':
        this.api = chrome.storage.sync;
        this.get = chrome.storage.sync.get;
        this.set = chrome.storage.sync.set;
        this.clear = chrome.storage.sync.clear;
        break;

      case 'webpage':
        this.api = window.localStorage;

        this.get = (defaults, callback = noop) => {
          if (defaults) {
            let items = {};
            for (let key in defaults) {
              let value = window.localStorage.getItem(key) || defaults[key];
              if (typeof value === 'string') {
                if (value === 'true') {
                  value = true;
                } else if (value === 'false') {
                  value = false;
                } else if (/^[+-]?\d\.\d+(?:[Ee][+-]?\d+)?$/.test(value)) {
                  value = parseFloat(value);
                } else if (/^[+-]?\d+(?:[Ee][+-]?\d+)?$/.test(value)) {
                  value = parseInt(value);
                }
              }
              items[key] = value;
            }
            callback(items);
          } else {
            callback(window.localStorage);
          }
        };

        this.set = (items, callback = noop) => {
          for (let key in items) {
            window.localStorage.setItem(key, items[key]);
          }
          callback();
        };

        this.clear = (callback = noop) => {
          window.localStorage.clear();
          callback();
        };

        break;
    }
  }


  /*===== When the page is loaded, initialise the forms =====*/

  document.addEventListener('DOMContentLoaded', () => {

    /*===== Global Variables =====*/

    // Settings object, to track changes to the settings form
    var settings;

    // Environment - 'extension' or 'webpage'
    // Code is reused for the webpage version and extension version.
    // Some parts of the code need to know which one.
    var environment;
    try {
      // For Chrome browser, `chrome` will exist. A runtime id implies
      // this is running as an extension.
      environment = chrome && chrome.runtime && chrome.runtime.id ?
          'extension' : 'webpage';
    } catch (e) {
      // Some browsers will simply throw an extension is chrome is undefined
      console.error(e);
      environment = 'webpage';
    }


    // Add a class to the body for environment specific CSS
    document.body.classList.add(environment);

    // Storage object, to remember settings between sessions
    var storage = new Storage(environment);

    // Get forms and form elements by id and class
    var pwSetForm = getForm(
          'pw-set',
          'master-set-1 master-set-2 pw-submit-btn remember-password pw-mismatch pw-empty',
          'back about-btn'),
        mainForm = getForm(
          'main',
          'master site-host pw-result settings-btn pw-change pw-incorrect',
          'about-btn'),
        settingsForm = getForm(
          'settings',
          'pw-length lowercase uppercase number symbol',
          'back');



    /*===== Unique Password Generation Function =====*/

    /*
     *  Generate a password from the form parameters and display it in the form
     */
    function generatePassword() {
      var pw = mainForm.master.value,
          sh = mainForm.siteHost.value;

      // Don't show error message until needed
      hide(mainForm.pwIncorrect);

      // Only generate if a master password has been entered
      if (pw !== '') {
        if (settings.rememberPassword) {
          verifyPassword(pw, correct => {
            if (!correct) {
              // Master password is incorrect so show a warning
              show(mainForm.pwIncorrect);
              mainForm.master.select();
            }
          });
        }

        // Only generate if a site has been entered
        if (sh !== '') {
          mainForm.pwResult.value = '';
          mainForm.pwResult.placeholder = 'Generating...';

          // Generate a password to use, regardless of correct password
          uniquify(pw, sh, unique => {
            mainForm.pwResult.value = unique;
            mainForm.pwResult.placeholder = '';
            mainForm.pwResult.select();
          }, settings);
        }
      }
    }



    /*===== Set a new a master password function =====*/

    /*
     *  Callback for when a new master password is submitted
     *  Checks that the password matches the confirm password,
     *  then stores it if Remember Password is enabled.
     *  Then goes to the main form and runs generatePassword.
     */
    function setMasterPassword() {
      // Check that password and confirm password match
      var pw1 = pwSetForm.masterSet1.value,
          pw2 = pwSetForm.masterSet2.value;

      // Hide warnings until relevant
      hide(pwSetForm.pwEmpty);
      hide(pwSetForm.pwMismatch);

      if (pw1 === '' || pw2 === '') {
        // Password is an empty string, show warning
        show(pwSetForm.pwEmpty);
      } else if (pw1 !== pw2) {
        // Passwords do not match, show warning
        show(pwSetForm.pwMismatch);
      } else {
        // Clear out master password fields
        pwSetForm.masterSet1.value = '';
        pwSetForm.masterSet2.value = '';

        // Move password across to main form
        mainForm.master.value = pw1;
        mainForm.pwResult.value = '';
        hide(mainForm.pwIncorrect);

        if (pwSetForm.rememberPassword.checked) {
          // Save updated password hash
          storePassword(pw1, onPasswordSet);
        } else {
          // Clear out any stored passwords
          clearPassword(onPasswordSet);
        }
      }
    }


    /*
     *  Function to be run after a new master password has been set.
     *  Goes back to the main form and either generates or focusses
     *  missing information.
     */
    function onPasswordSet() {
      // Back to main form
      hide(pwSetForm);
      show(mainForm);

      // Password was just set, so generate right away if
      // site is filled in.
      if (mainForm.siteHost.value) {
        generatePassword();
      } else {
        // If the site has not been filled in, focus it.
        mainForm.siteHost.focus();
      }
    }


    // Master password storage parameter constants
    // The amount of salt and pepper to add to the master password before hashing
    // and storage, in terms of the lengths of those appended strings.
    const saltiness = 16,
          pepperiness = 2,
          pepperLimit = 0x1 << (4 * pepperiness);


    /*
     *  Salts and peppers a password before converting to a hex dump string for storage.
     *  The pepper is a random byte. Every permutation must be tried to verify a password,
     *  slowing a potential hacker down
     */
    function storePassword(pw, callback) {
      // Salt the password with a random string of characters.
      // This will be stored along with the password, reducing the effectiveness
      // brute force attacks
      let salt = randomChars(saltiness);

      // Pepper is also appended to the password, but is not stored.
      // Every possibility for the pepper must be tested when verifying the password
      let pepper = randomHex(pepperiness);

      // Hash it all together for storage
      sha(512, pw + salt + pepper, hash => {
        settings.masterHash = hash;
        settings.masterSalt = salt;
        settings.rememberPassword = true;

        storage.set(settings, callback);
      }, hexSettings);
    }


    /*
     *  Compares a password against the details stored in the settings.
     *  The callback is called when the password is verified or found
     *  to be incorrect and is a function(correct : boolean)
     */
    function verifyPassword(pw, callback) {
      // Must try every possibility for the pepper
      (function hashAndCompare(pw, i, callback) {
        let salt = settings.masterSalt,
            pepper = hexPad(i, pepperiness);

        sha(512, pw + salt + pepper, hash => {
          if (hash === settings.masterHash) {
            // Password is correct with this pepper
            callback(true);
          } else if (i --> 0) {
            // Move i towards zero to try next guess for pepper
            hashAndCompare(pw, i, callback);
          } else {
            // Ran out of guesses -> incorrect
            callback(false);
          }
        }, hexSettings);
      })(pw, pepperLimit, callback);
    }


    /*
     *  Overwrites stored passwords
     *  If remember password is unchecked, clear out any old hashes
     *  and make the user go through the password set page to enter a
     *  password
     *  The callback is called once the password data has been
     *  overwritten
     */
    function clearPassword(callback) {
      // Don't remember password
      settings.rememberPassword = false;

      // Clear out old hashes. These values do not
      // matter but should not be explicitly referenced
      settings.masterHash = 'do_not_remember';
      settings.masterSalt = 'do_not_remember';

      // Store the changes to settings
      // Then call the callback once stored
      storage.set(settings, callback);
    }



    /*===== Restore forms from stored settings =====*/

    storage.get(defaultSettings, items => {

      if (items.masterHash === defaultSettings.masterHash) {
        // Password has not been set -> first time set up
        show(pwSetForm);

        // Use a copy of default settings, until overwritten
        settings = JSON.parse(JSON.stringify(defaultSettings));

        // The settings object will be saved when the user sets
        // their password
      } else {
        if (items.rememberPassword) {
          // Password is set
          show(mainForm);
        } else {
          // Password not remembered -> go to password set form
          show(pwSetForm);
        }

        // Settings are as they were last stored
        settings = items;

        // Fill settings form with settings from last time
        settingsForm.pwLength.value    = items.pwLength;
        settingsForm.lowercase.checked = items.lowercase;
        settingsForm.uppercase.checked = items.uppercase;
        settingsForm.number.checked    = items.number;
        settingsForm.symbol.checked    = items.symbol;

        // Also the remember password option
        pwSetForm.rememberPassword.checked = items.rememberPassword;
      }
    });



    /*===== Get the active tab url and put it in the main form =====*/

    // For an extension, use the chrome.tabs api to get the URL.
    // For the webpage version, the user must fill in the site manually.
    if (environment === 'extension') {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        // The query will return an array containing only the active tab.
        // Get the active tab's url and reduce it to the host
        mainForm.siteHost.value = tabs[0].url.match(
          /^(?:https?:\/\/)?([\w\.]+?)(?:\/.*)?$/)[1];
      });
    }



    /*===== Main Form Event Listeners =====*/

    // Whenever anything changes here, generate a password.
    // There are also links to the other two forms

    mainForm.master.addEventListener('change', generatePassword);

    mainForm.siteHost.addEventListener('change', generatePassword);

    mainForm.settingsBtn.addEventListener('click', () => {
      // Go to settings form
      hide(mainForm);
      show(settingsForm);
    });

    mainForm.pwChange.addEventListener('click', () => {
      // Go to password set form
      hide(mainForm);
      show(pwSetForm);

      // Show the back button.
      // It's hidden by default for first time set up
      show(pwSetForm.back);

      // Focus the first password field
      pwSetForm.masterSet1.focus();
    });


    // About button transitions to fuller webpage css
    mainForm.aboutBtn.addEventListener('click', () => {
      document.body.classList.remove('extension');
      document.body.classList.add('webpage');
    });



    /*===== Settings Form Event Listeners =====*/

    // Whenever anything changes on the settings form, update the
    // settings object and store the new settings

    settingsForm.pwLength.addEventListener('change', () => {
      settings.pwLength = parseInt(settingsForm.pwLength.value);
      storage.set(settings);
    });

    settingsForm.lowercase.addEventListener('change', () => {
      settings.lowercase = settingsForm.lowercase.checked;
      storage.set(settings);
    });

    settingsForm.uppercase.addEventListener('change', () => {
      settings.uppercase = settingsForm.uppercase.checked;
      storage.set(settings);
    });

    settingsForm.number.addEventListener('change', () => {
      settings.number = settingsForm.number.checked;
      storage.set(settings);
    });

    settingsForm.symbol.addEventListener('change', () => {
      settings.symbol = settingsForm.symbol.checked;
      storage.set(settings);
    });

    settingsForm.back.addEventListener('click', () => {
      // Back to main form
      hide(settingsForm);
      show(mainForm);

      // Regenerate the password
      generatePassword();
    });



    /*===== Set Password Form Event Listeners =====*/

    // Whenever the button is clicked, or enter is pressed in the password
    // fields, set the new password.

    function onEnterKey(e) {
      if (e.keyCode === 13) { // Enter
        setMasterPassword();
      }
    }

    pwSetForm.pwSubmitBtn.addEventListener('click', setMasterPassword);

    pwSetForm.masterSet1.addEventListener('keyup', onEnterKey);

    pwSetForm.masterSet2.addEventListener('keyup', onEnterKey);

    pwSetForm.back.addEventListener('click', e => {
      // Go back to the main form
      hide(pwSetForm);
      show(mainForm);

      // If remember password is now unchecked, delete any old passwords
      if (!pwSetForm.rememberPassword.checked) {
        clearPassword();
      }
    });

    // About button transitions to fuller webpage css
    pwSetForm.aboutBtn.addEventListener('click', () => {
      document.body.classList.remove('extension');
      document.body.classList.add('webpage');
    });



    /*===== Accordion click handlers for the About section =====*/

    function accordion(e) {
      e.currentTarget.classList.toggle('active');
    }

    for (let acc of document.getElementsByClassName('accordion')) {
      acc.addEventListener('click', accordion);
    }

  });

})();
