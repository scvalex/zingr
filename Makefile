all:
	@echo "You probably want 'make serve'"

.PHONY: all serve clean

serve:
	./zingr.py

clean:
