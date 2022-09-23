
build:
	anchor build && npm run build
.PHONY: build

test:
	make build && anchor test
.PHONY: test

deploy:
	make build && anchor deploy --provider.cluster devnet
.PHONY: deploy
