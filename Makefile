jshint:
	jshint --show-non-errors **/*.js

test:
	./node_modules/.bin/mocha --reporter list

.PHONY: test jshint
