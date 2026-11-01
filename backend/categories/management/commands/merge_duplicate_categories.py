import re
from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from categories.models import Category
from products.models import Product


class Command(BaseCommand):
    help = 'Finds, merges, and cleans case-insensitive duplicate categories, updating linked products before deleting duplicates.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate the merge without committing changes to database.'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        self.stdout.write(self.style.NOTICE(f"Scanning categories (Dry run: {dry_run})..."))

        all_categories = Category.objects.all().order_by('id')
        grouped = defaultdict(list)

        for cat in all_categories:
            normalized_name = re.sub(r'\s+', ' ', cat.name).strip().lower()
            grouped[normalized_name].append(cat)

        duplicates_found = 0
        products_reassigned = 0

        with transaction.atomic():
            for norm_key, cat_list in grouped.items():
                # Clean whitespace on all names
                for c in cat_list:
                    cleaned_name = re.sub(r'\s+', ' ', c.name).strip()
                    if c.name != cleaned_name:
                        self.stdout.write(f"Whitespace cleaned: '{c.name}' -> '{cleaned_name}' (ID: {c.id})")
                        if not dry_run:
                            c.name = cleaned_name
                            c.save(update_fields=['name'])

                if len(cat_list) > 1:
                    duplicates_found += (len(cat_list) - 1)
                    # Pick canonical: prefer active category, then lowest id
                    active_cats = [c for c in cat_list if c.is_active and not c.is_deleted]
                    canonical = active_cats[0] if active_cats else cat_list[0]
                    duplicates = [c for c in cat_list if c.id != canonical.id]

                    self.stdout.write(self.style.WARNING(
                        f"Found duplicate group for '{norm_key}': Keeping ID {canonical.id} ('{canonical.name}')"
                    ))

                    for dup in duplicates:
                        linked_products = Product.objects.filter(category=dup)
                        count = linked_products.count()
                        if count > 0:
                            self.stdout.write(
                                f"  Reassigning {count} product(s) from duplicate ID {dup.id} ('{dup.name}') -> canonical ID {canonical.id}"
                            )
                            if not dry_run:
                                linked_products.update(category=canonical)
                            products_reassigned += count

                        self.stdout.write(f"  Deleting duplicate Category ID {dup.id} ('{dup.name}')...")
                        if not dry_run:
                            dup.delete()

            if dry_run:
                self.stdout.write(self.style.SUCCESS(
                    f"DRY RUN complete: {duplicates_found} duplicates found, {products_reassigned} products would be reassigned. (No changes saved)."
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"SUCCESS: {duplicates_found} duplicate categories merged/deleted. {products_reassigned} products reassigned."
                ))
